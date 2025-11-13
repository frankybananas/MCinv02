import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import FacebookPost, { IFacebookPost } from '../../models/FacebookPost';

describe('FacebookPost Model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }, 60000); // 60 second timeout for MongoDB setup

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await FacebookPost.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid FacebookPost document', async () => {
      const userId = new mongoose.Types.ObjectId();
      const carId = new mongoose.Types.ObjectId();
      
      const postData = {
        userId,
        carId,
        content: 'Check out this amazing car!',
        hashtags: ['#cars', '#forsale'],
        imageUrls: ['https://example.com/image1.jpg'],
        status: 'pending' as const,
        retryCount: 0,
        maxRetries: 3,
        aiModel: 'gemini-1.5-flash',
        aiPromptVersion: 'v1.0'
      };

      const post = await FacebookPost.create(postData);

      expect(post.userId.toString()).toBe(userId.toString());
      expect(post.carId.toString()).toBe(carId.toString());
      expect(post.content).toBe('Check out this amazing car!');
      expect(post.hashtags).toHaveLength(2);
      expect(post.imageUrls).toHaveLength(1);
      expect(post.status).toBe('pending');
    });

    it('should require userId field', async () => {
      const postData = {
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      };

      await expect(FacebookPost.create(postData)).rejects.toThrow();
    });

    it('should require carId field', async () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      };

      await expect(FacebookPost.create(postData)).rejects.toThrow();
    });

    it('should require content field', async () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        hashtags: [],
        imageUrls: []
      };

      await expect(FacebookPost.create(postData)).rejects.toThrow();
    });
  });

  describe('Status Field', () => {
    it('should default status to pending', async () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      };

      const post = await FacebookPost.create(postData);
      expect(post.status).toBe('pending');
    });

    it('should only allow valid status values', async () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        status: 'invalid' as any,
        hashtags: [],
        imageUrls: []
      };

      await expect(FacebookPost.create(postData)).rejects.toThrow();
    });

    it('should allow all valid status values', async () => {
      const validStatuses = ['pending', 'processing', 'published', 'failed', 'scheduled'];
      
      for (const status of validStatuses) {
        const post = await FacebookPost.create({
          userId: new mongoose.Types.ObjectId(),
          carId: new mongoose.Types.ObjectId(),
          content: 'Test',
          status: status as any,
          hashtags: [],
          imageUrls: []
        });
        
        expect(post.status).toBe(status);
      }
    });
  });

  describe('Retry Logic Fields', () => {
    it('should default retryCount to 0', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      });

      expect(post.retryCount).toBe(0);
    });

    it('should default maxRetries to 3', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      });

      expect(post.maxRetries).toBe(3);
    });

    it('should allow custom maxRetries', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        maxRetries: 5,
        hashtags: [],
        imageUrls: []
      });

      expect(post.maxRetries).toBe(5);
    });

    it('should track retry attempts', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        retryCount: 2,
        hashtags: [],
        imageUrls: []
      });

      expect(post.retryCount).toBe(2);
    });
  });

  describe('AI Generation Fields', () => {
    it('should default aiModel to gemini-1.5-flash', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      });

      expect(post.aiModel).toBe('gemini-1.5-flash');
    });

    it('should default aiPromptVersion to v1.0', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      });

      expect(post.aiPromptVersion).toBe('v1.0');
    });

    it('should allow custom AI model', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        aiModel: 'gemini-2.0-pro',
        hashtags: [],
        imageUrls: []
      });

      expect(post.aiModel).toBe('gemini-2.0-pro');
    });

    it('should store generation time', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        generationTime: 1500,
        hashtags: [],
        imageUrls: []
      });

      expect(post.generationTime).toBe(1500);
    });
  });

  describe('Optional Fields', () => {
    it('should allow optional scheduledFor date', async () => {
      const scheduledDate = new Date(Date.now() + 3600000);
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        scheduledFor: scheduledDate,
        hashtags: [],
        imageUrls: []
      });

      expect(post.scheduledFor).toEqual(scheduledDate);
    });

    it('should allow optional publishedAt date', async () => {
      const publishedDate = new Date();
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        publishedAt: publishedDate,
        hashtags: [],
        imageUrls: []
      });

      expect(post.publishedAt).toEqual(publishedDate);
    });

    it('should allow optional facebookPostId', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        facebookPostId: '123456789_987654321',
        hashtags: [],
        imageUrls: []
      });

      expect(post.facebookPostId).toBe('123456789_987654321');
    });

    it('should allow optional error message', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        status: 'failed',
        error: 'Token expired',
        hashtags: [],
        imageUrls: []
      });

      expect(post.error).toBe('Token expired');
    });

    it('should allow optional lastAttempt date', async () => {
      const attemptDate = new Date();
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        lastAttempt: attemptDate,
        hashtags: [],
        imageUrls: []
      });

      expect(post.lastAttempt).toEqual(attemptDate);
    });
  });

  describe('Analytics Field', () => {
    it('should allow analytics object', async () => {
      const analytics = {
        likes: 50,
        comments: 10,
        shares: 5,
        reach: 1000,
        engagement: 65,
        lastSynced: new Date()
      };

      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        analytics,
        hashtags: [],
        imageUrls: []
      });

      expect(post.analytics?.likes).toBe(50);
      expect(post.analytics?.comments).toBe(10);
      expect(post.analytics?.shares).toBe(5);
      expect(post.analytics?.reach).toBe(1000);
      expect(post.analytics?.engagement).toBe(65);
      expect(post.analytics?.lastSynced).toBeDefined();
    });

    it('should allow partial analytics', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        analytics: { likes: 10 },
        hashtags: [],
        imageUrls: []
      });

      expect(post.analytics?.likes).toBe(10);
      expect(post.analytics?.comments).toBeUndefined();
    });
  });

  describe('Arrays', () => {
    it('should store multiple hashtags', async () => {
      const hashtags = ['#car', '#forsale', '#luxury', '#deal'];
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags,
        imageUrls: []
      });

      expect(post.hashtags).toHaveLength(4);
      expect(post.hashtags).toEqual(hashtags);
    });

    it('should store multiple image URLs', async () => {
      const imageUrls = [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg'
      ];

      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls
      });

      expect(post.imageUrls).toHaveLength(3);
      expect(post.imageUrls).toEqual(imageUrls);
    });

    it('should allow empty arrays', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      });

      expect(post.hashtags).toHaveLength(0);
      expect(post.imageUrls).toHaveLength(0);
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt and updatedAt', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        hashtags: [],
        imageUrls: []
      });

      expect(post.createdAt).toBeDefined();
      expect(post.updatedAt).toBeDefined();
      expect(post.createdAt).toBeInstanceOf(Date);
      expect(post.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Query Operations', () => {
    it('should find posts by userId', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      await FacebookPost.create({
        userId,
        carId: new mongoose.Types.ObjectId(),
        content: 'Test 1',
        hashtags: [],
        imageUrls: []
      });

      await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test 2',
        hashtags: [],
        imageUrls: []
      });

      const userPosts = await FacebookPost.find({ userId });
      expect(userPosts).toHaveLength(1);
      expect(userPosts[0].userId.toString()).toBe(userId.toString());
    });

    it('should find posts by status', async () => {
      await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test 1',
        status: 'published',
        hashtags: [],
        imageUrls: []
      });

      await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test 2',
        status: 'pending',
        hashtags: [],
        imageUrls: []
      });

      const publishedPosts = await FacebookPost.find({ status: 'published' });
      expect(publishedPosts).toHaveLength(1);
      expect(publishedPosts[0].status).toBe('published');
    });

    it('should find posts by carId', async () => {
      const carId = new mongoose.Types.ObjectId();
      
      await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId,
        content: 'Test 1',
        hashtags: [],
        imageUrls: []
      });

      await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test 2',
        hashtags: [],
        imageUrls: []
      });

      const carPosts = await FacebookPost.find({ carId });
      expect(carPosts).toHaveLength(1);
      expect(carPosts[0].carId.toString()).toBe(carId.toString());
    });

    it('should find scheduled posts', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      
      await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test 1',
        status: 'scheduled',
        scheduledFor: futureDate,
        hashtags: [],
        imageUrls: []
      });

      await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test 2',
        status: 'pending',
        hashtags: [],
        imageUrls: []
      });

      const scheduledPosts = await FacebookPost.find({ 
        status: 'scheduled',
        scheduledFor: { $lte: new Date(Date.now() + 7200000) }
      });
      
      expect(scheduledPosts).toHaveLength(1);
    });
  });

  describe('Account Type', () => {
    it('should store accountType', async () => {
      const post = await FacebookPost.create({
        userId: new mongoose.Types.ObjectId(),
        carId: new mongoose.Types.ObjectId(),
        content: 'Test',
        accountType: 'business_page',
        facebookPageId: '123456',
        hashtags: [],
        imageUrls: []
      });

      expect(post.accountType).toBe('business_page');
      expect(post.facebookPageId).toBe('123456');
    });
  });
});
