import { connectDB } from '@/lib/database';
import { decryptSecret } from '@/lib/credential-crypto';
import { GitHubInstallationModel, type GitHubInstallationDocument } from '@/models/GitHubInstallation';
import { LLMCredentialModel, type LLMCredentialDocument } from '@/models/LLMCredential';
import type { LLMConfig } from '@/lib/llm';

function byokRequired(): boolean {
  return String(process.env.REQUIRE_BYOK || '').toLowerCase() === 'true';
}

export async function resolveAccountLLMConfig(installationId?: number): Promise<LLMConfig | undefined> {
  try {
    if (!installationId) {
      if (byokRequired()) throw new Error('A GitHub installation is required to resolve the customer LLM credential');
      return undefined;
    }

    await connectDB();
    const installation = await GitHubInstallationModel.findOne({ installationId }) as GitHubInstallationDocument | null;
    if (!installation) {
      if (byokRequired()) throw new Error('GitHub installation is not registered');
      return undefined;
    }

    const credential = await LLMCredentialModel.findOne({ githubAccountId: installation.accountId })
      .select('+encryptedApiKey +encryptionIv +authTag +keyVersion') as LLMCredentialDocument | null;
    if (!credential) {
      if (byokRequired()) throw new Error(`No LLM credential configured for ${installation.accountLogin}`);
      return undefined;
    }

    return {
      provider: credential.provider,
      model: credential.modelName,
      apiKey: decryptSecret({
        ciphertext: credential.encryptedApiKey,
        iv: credential.encryptionIv,
        authTag: credential.authTag,
        keyVersion: credential.keyVersion,
      }),
    };
  } catch (error) {
    if (byokRequired()) throw error;
    console.warn('Could not resolve account BYOK configuration; using deployment LLM configuration.');
    return undefined;
  }
}
