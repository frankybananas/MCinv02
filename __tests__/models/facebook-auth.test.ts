import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import FacebookAuth, { IFacebookAuth } from '../../models/FacebookAuth';

describe('FacebookAuth Model', () => {
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
    await FacebookAuth.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid FacebookAuth document', async () => {
      const userId = new mongoose.Types.ObjectId();
      const authData = {
        userId,
        accessToken: 'encrypted-access-token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600000),
        accountType: 'personal' as const,
        grantedPermissions: ['pages_manage_posts', 'pages_read_engagement'],
        isActive: true
      };

      const auth = await FacebookAuth.create(authData);

      expect(auth.userId.toString()).toBe(userId.toString());
      expect(auth.accessToken).toBe('encrypted-access-token');
      expect(auth.tokenType).toBe('Bearer');
      expect(auth.accountType).toBe('personal');
      expect(auth.isActive).toBe(true);
      expect(auth.grantedPermissions).toHaveLength(2);
    });

    it('should require userId field', async () => {
      const authData = {
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      await expect(FacebookAuth.create(authData)).rejects.toThrow();
    });

    it('should require accessToken field', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        tokenType: 'Bearer',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      await expect(FacebookAuth.create(authData)).rejects.toThrow();
    });

    it('should require expiresAt field', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        tokenType: 'Bearer',
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      await expect(FacebookAuth.create(authData)).rejects.toThrow();
    });

    it('should require accountType field', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresAt: new Date(),
        grantedPermissions: []
      };

      await expect(FacebookAuth.create(authData)).rejects.toThrow();
    });

    it('should only allow valid accountType values', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresAt: new Date(),
        accountType: 'invalid' as any,
        grantedPermissions: []
      };

      await expect(FacebookAuth.create(authData)).rejects.toThrow();
    });

    it('should default tokenType to Bearer', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.tokenType).toBe('Bearer');
    });

    it('should default isActive to true', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.isActive).toBe(true);
    });
  });

  describe('Personal Account Type', () => {
    it('should create personal account with facebookUserId', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        facebookUserId: '123456789',
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.accountType).toBe('personal');
      expect(auth.facebookUserId).toBe('123456789');
    });
  });

  describe('Business Page Account Type', () => {
    it('should create business page account with page details', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'business_page' as const,
        facebookPageId: '987654321',
        facebookPageName: 'My Business Page',
        facebookPageAccessToken: 'page-token',
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.accountType).toBe('business_page');
      expect(auth.facebookPageId).toBe('987654321');
      expect(auth.facebookPageName).toBe('My Business Page');
      expect(auth.facebookPageAccessToken).toBe('page-token');
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique userId constraint', async () => {
      const userId = new mongoose.Types.ObjectId();
      const authData = {
        userId,
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      await FacebookAuth.create(authData);
      await expect(FacebookAuth.create(authData)).rejects.toThrow();
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt and updatedAt', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.createdAt).toBeDefined();
      expect(auth.updatedAt).toBeDefined();
      expect(auth.createdAt).toBeInstanceOf(Date);
      expect(auth.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      const originalUpdatedAt = auth.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      auth.isActive = false;
      await auth.save();

      expect(auth.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Optional Fields', () => {
    it('should allow optional refreshToken', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        refreshToken: 'refresh-token',
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.refreshToken).toBe('refresh-token');
    });

    it('should allow optional lastUsed', async () => {
      const lastUsed = new Date();
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        lastUsed,
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.lastUsed).toEqual(lastUsed);
    });
  });

  describe('Permissions Array', () => {
    it('should store multiple permissions', async () => {
      const permissions = [
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_show_list'
      ];

      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: permissions
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.grantedPermissions).toHaveLength(3);
      expect(auth.grantedPermissions).toEqual(permissions);
    });

    it('should allow empty permissions array', async () => {
      const authData = {
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      };

      const auth = await FacebookAuth.create(authData);
      expect(auth.grantedPermissions).toHaveLength(0);
    });
  });

  describe('Query Operations', () => {
    it('should find by userId', async () => {
      const userId = new mongoose.Types.ObjectId();
      await FacebookAuth.create({
        userId,
        accessToken: 'token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      });

      const found = await FacebookAuth.findOne({ userId });
      expect(found).toBeDefined();
      expect(found?.userId.toString()).toBe(userId.toString());
    });

    it('should find active accounts', async () => {
      await FacebookAuth.create({
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token1',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        isActive: true,
        grantedPermissions: []
      });

      await FacebookAuth.create({
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token2',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        isActive: false,
        grantedPermissions: []
      });

      const activeAccounts = await FacebookAuth.find({ isActive: true });
      expect(activeAccounts).toHaveLength(1);
      expect(activeAccounts[0].isActive).toBe(true);
    });

    it('should find by accountType', async () => {
      await FacebookAuth.create({
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token1',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      });

      await FacebookAuth.create({
        userId: new mongoose.Types.ObjectId(),
        accessToken: 'token2',
        expiresAt: new Date(),
        accountType: 'business_page' as const,
        grantedPermissions: []
      });

      const businessAccounts = await FacebookAuth.find({ accountType: 'business_page' });
      expect(businessAccounts).toHaveLength(1);
      expect(businessAccounts[0].accountType).toBe('business_page');
    });
  });

  describe('Token Security', () => {
    it('should not return accessToken by default (select: false)', async () => {
      const userId = new mongoose.Types.ObjectId();
      await FacebookAuth.create({
        userId,
        accessToken: 'secret-token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      });

      const found = await FacebookAuth.findOne({ userId });
      expect(found?.accessToken).toBeUndefined();
    });

    it('should return accessToken when explicitly selected', async () => {
      const userId = new mongoose.Types.ObjectId();
      await FacebookAuth.create({
        userId,
        accessToken: 'secret-token',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      });

      const found = await FacebookAuth.findOne({ userId }).select('+accessToken');
      expect(found?.accessToken).toBe('secret-token');
    });

    it('should not return refreshToken by default (select: false)', async () => {
      const userId = new mongoose.Types.ObjectId();
      await FacebookAuth.create({
        userId,
        accessToken: 'token',
        refreshToken: 'secret-refresh',
        expiresAt: new Date(),
        accountType: 'personal' as const,
        grantedPermissions: []
      });

      const found = await FacebookAuth.findOne({ userId });
      expect(found?.refreshToken).toBeUndefined();
    });

    it('should not return facebookPageAccessToken by default (select: false)', async () => {
      const userId = new mongoose.Types.ObjectId();
      await FacebookAuth.create({
        userId,
        accessToken: 'token',
        facebookPageAccessToken: 'page-secret',
        expiresAt: new Date(),
        accountType: 'business_page' as const,
        grantedPermissions: []
      });

      const found = await FacebookAuth.findOne({ userId });
      expect(found?.facebookPageAccessToken).toBeUndefined();
    });
  });
});
