// MongoDB initialization script
db = db.getSiblingDB('credit_card_checker');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: {
          bsonType: 'string',
          description: 'Username must be a string and is required'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          description: 'Email must be a valid email address'
        },
        password: {
          bsonType: 'string',
          minLength: 6,
          description: 'Password must be at least 6 characters'
        },
        balance: {
          bsonType: 'number',
          minimum: 0,
          description: 'Balance must be a non-negative number'
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'admin'],
          description: 'Role must be either user or admin'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'blocked'],
          description: 'Status must be either active or blocked'
        }
      }
    }
  }
});

db.createCollection('cards', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['cardNumber', 'status'],
      properties: {
        cardNumber: {
          bsonType: 'string',
          description: 'Card number is required'
        },
        status: {
          bsonType: 'string',
          enum: ['live', 'die', 'unknown', 'checking'],
          description: 'Status must be one of the allowed values'
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });

db.cards.createIndex({ cardNumber: 1 });
db.cards.createIndex({ userId: 1 });
db.cards.createIndex({ status: 1 });
db.cards.createIndex({ createdAt: -1 });

db.payment_requests.createIndex({ userId: 1 });
db.payment_requests.createIndex({ status: 1 });
db.payment_requests.createIndex({ createdAt: -1 });

db.transactions.createIndex({ userId: 1 });
db.transactions.createIndex({ type: 1 });
db.transactions.createIndex({ createdAt: -1 });

db.site_config.createIndex({ key: 1 }, { unique: true });
db.site_config.createIndex({ category: 1 });

// Insert default admin user
db.users.insertOne({
  username: 'admin',
  email: 'admin@example.com',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx/LBK2.', // password: admin123
  balance: 0,
  role: 'admin',
  status: 'active',
  totalCardsSubmitted: 0,
  totalLiveCards: 0,
  totalDieCards: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Insert default site configuration
const defaultConfigs = [
  { key: 'site_title', value: 'Credit Card Checker', type: 'text', category: 'seo' },
  { key: 'site_description', value: 'Professional Credit Card Checking Service', type: 'textarea', category: 'seo' },
  { key: 'site_keywords', value: 'credit card, checker, validation, security', type: 'text', category: 'seo' },
  { key: 'og_title', value: 'Credit Card Checker', type: 'text', category: 'seo' },
  { key: 'og_description', value: 'Professional Credit Card Checking Service', type: 'textarea', category: 'seo' },
  { key: 'twitter_title', value: 'Credit Card Checker', type: 'text', category: 'seo' },
  { key: 'twitter_description', value: 'Professional Credit Card Checking Service', type: 'textarea', category: 'seo' },
  { key: 'default_price_per_card', value: '0.1', type: 'number', category: 'pricing' },
  { key: 'min_deposit_amount', value: '10', type: 'number', category: 'payment' },
  { key: 'max_cards_per_check', value: '1000', type: 'number', category: 'general' }
];

db.site_config.insertMany(defaultConfigs.map(config => ({
  ...config,
  updatedAt: new Date()
})));

// Insert default pricing configuration
db.pricing_config.insertMany([
  {
    minCards: 1,
    maxCards: 100,
    pricePerCard: 0.1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    minCards: 101,
    maxCards: 500,
    pricePerCard: 0.08,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    minCards: 501,
    maxCards: null,
    pricePerCard: 0.05,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('Database initialized successfully!');
