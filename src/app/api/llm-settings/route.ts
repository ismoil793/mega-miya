import { NextRequest, NextResponse } from 'next/server';
import { encryptSecret } from '@/lib/credential-crypto';
import { getAuthenticatedUser, hasValidRequestOrigin } from '@/lib/auth';
import { LLMCredentialModel, type StoredAIProvider } from '@/models/LLMCredential';

const PROVIDERS = new Set<StoredAIProvider>(['openai', 'anthropic']);

function ownerAccount(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>, accountId: number) {
  return user.authorizedAccounts.find(
    (account) => account.githubAccountId === accountId && account.role === 'owner',
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const accounts = user.authorizedAccounts.filter((account) => account.role === 'owner');
    const credentials = await LLMCredentialModel.find({
      githubAccountId: { $in: accounts.map((account) => account.githubAccountId) },
    }).lean();
    const byAccountId = new Map(credentials.map((credential) => [credential.githubAccountId, credential]));

    return NextResponse.json({
      accounts: accounts.map((account) => {
        const credential = byAccountId.get(account.githubAccountId);
        return {
          githubAccountId: account.githubAccountId,
          login: account.login,
          type: account.type,
          credential: credential ? {
            provider: credential.provider,
            model: credential.modelName,
            keyLastFour: credential.keyLastFour,
            updatedAt: credential.updatedAt,
          } : null,
        };
      }),
    });
  } catch (error) {
    console.error('Failed to get LLM settings:', error);
    return NextResponse.json({ error: 'Failed to get LLM settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!hasValidRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const accountId = Number(body.githubAccountId);
    const provider = String(body.provider || '').toLowerCase() as StoredAIProvider;
    const model = String(body.model || '').trim();
    const apiKey = String(body.apiKey || '').trim();

    if (!Number.isSafeInteger(accountId) || !ownerAccount(user, accountId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!PROVIDERS.has(provider)) {
      return NextResponse.json({ error: 'Unsupported AI provider' }, { status: 400 });
    }
    if (!model || model.length > 120 || !/^[a-zA-Z0-9._:/-]+$/.test(model)) {
      return NextResponse.json({ error: 'Invalid model name' }, { status: 400 });
    }
    if (apiKey.length < 8 || apiKey.length > 512) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }

    const encrypted = encryptSecret(apiKey);
    await LLMCredentialModel.findOneAndUpdate(
      { githubAccountId: accountId },
      {
        $set: {
          provider,
          modelName: model,
          encryptedApiKey: encrypted.ciphertext,
          encryptionIv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          keyLastFour: apiKey.slice(-4),
          configuredByUserId: user._id,
        },
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({
      success: true,
      credential: { provider, model, keyLastFour: apiKey.slice(-4) },
    });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('AI_API_CREDENTIAL_ENCRYPTION_KEY')
      ? error.message
      : 'Failed to save LLM settings';
    console.error('Failed to save LLM settings:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!hasValidRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const accountId = Number(request.nextUrl.searchParams.get('githubAccountId'));
    if (!Number.isSafeInteger(accountId) || !ownerAccount(user, accountId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await LLMCredentialModel.deleteOne({ githubAccountId: accountId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete LLM settings:', error);
    return NextResponse.json({ error: 'Failed to delete LLM settings' }, { status: 500 });
  }
}
