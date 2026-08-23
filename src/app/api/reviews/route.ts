import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/database';
import { CodeReviewModel } from '@/models/CodeReview';
import { ApiResponse, PaginatedResponse } from '@/types';
import { getAuthenticatedUser, hasValidRequestOrigin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);
    const repository = searchParams.get('repository');
    const status = searchParams.get('status');

    // Build query
    const query: any = { repositoryName: { $in: user.repositories } };
    if (repository) {
      if (!user.repositories.includes(repository)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      query.repositoryName = repository;
    }
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const total = await CodeReviewModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Fetch reviews
    const reviews = await CodeReviewModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const response: PaginatedResponse<any> = {
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasValidRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { pullRequestId, repositoryId, repositoryName } = body;

    if (!pullRequestId || !repositoryId || !repositoryName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!user.repositories.includes(repositoryName)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    // Check if review already exists
    const existingReview = await CodeReviewModel.findOne({
      pullRequestId,
      repositoryId,
    });

    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists for this pull request' },
        { status: 409 }
      );
    }

    // Create new review
    const review = new CodeReviewModel({
      pullRequestId,
      repositoryId,
      repositoryName,
      status: 'pending',
    });

    await review.save();

    const response: ApiResponse = {
      success: true,
      data: review,
      message: 'Review created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Failed to create review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}
