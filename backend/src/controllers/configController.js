const SiteConfig = require('../models/SiteConfig');
const PricingConfig = require('../models/PricingConfig');
const logger = require('../config/logger');

// Public config controller (luôn trả về default khi DB lỗi thay vì 500)
exports.getPublicConfigs = async (req, res) => {
  let configs = {};
  try {
    // Cố gắng lấy từ DB (public)
    configs = await SiteConfig.getPublicConfigs();
  } catch (err) {
    // Không chặn luồng: ghi log và dùng defaults an toàn
    logger.warn('DB lỗi khi getPublicConfigs, trả về defaults:', err?.message || err);
    configs = {};
  }

  // Bổ sung payment configs public: credit packages, credit per USD, crypto USD prices,
  // và các cờ hiển thị menu theo admin/settings
  try {
    const creditPerUsd = await SiteConfig.getByKey('payment_credit_per_usd');
    const creditPackages = await SiteConfig.getByKey('payment_credit_packages');
    const cryptoUsdPrices = await SiteConfig.getByKey('crypto_usd_prices');
    const showBuyCredits = await SiteConfig.getByKey('payment_show_buy_credits');
    const showCryptoPayment = await SiteConfig.getByKey('payment_show_crypto_payment');
    const minDeposit = await SiteConfig.getByKey('min_deposit_amount');
    const maxDeposit = await SiteConfig.getByKey('max_deposit_amount');
    
    // Thêm telegram_support_url vào general config
    const telegramUrl = await SiteConfig.getByKey('telegram_support_url');
    if (!configs.general) configs.general = {};
    configs.general.telegram_support_url = telegramUrl || '';
    // Thêm socket_url vào general config (ưu tiên DB -> ENV -> default theo môi trường)
    const socketUrlFromDb = await SiteConfig.getByKey('socket_url');
    const envSocket = process.env.SOCKET_URL;
    const defaultSocket = process.env.NODE_ENV === 'production' ? 'https://checkcc.live' : 'http://localhost:5000';
    configs.general.socket_url = socketUrlFromDb || envSocket || defaultSocket;
    
    // Ensure logo is in correct key
    const siteLogo = await SiteConfig.getByKey('site_logo');
    if (siteLogo) configs.general.site_logo = siteLogo;

    configs.payment = configs.payment || {};
    configs.payment.payment_credit_per_usd = Number(creditPerUsd || 10);
    configs.payment.payment_credit_packages = Array.isArray(creditPackages) ? creditPackages : [];
    if (cryptoUsdPrices && typeof cryptoUsdPrices === 'object') {
      configs.payment.crypto_usd_prices = cryptoUsdPrices;
    }
    // Exact boolean match - must be explicitly true from database
    configs.payment.payment_show_buy_credits = showBuyCredits === true;
    configs.payment.payment_show_crypto_payment = showCryptoPayment === true;
    configs.payment.min_deposit_amount = Number(minDeposit || 10);
    configs.payment.max_deposit_amount = Number(maxDeposit || 10000);

    // Fallback default packages nếu rỗng
    if (!configs.payment.payment_credit_packages || configs.payment.payment_credit_packages.length === 0) {
      configs.payment.payment_credit_packages = [
        { id: 1, credits: 100, price: 10, bonus: 0, popular: false, savings: '' },
        { id: 2, credits: 500, price: 45, bonus: 50, popular: true, savings: '10% off' },
        { id: 3, credits: 1000, price: 80, bonus: 200, popular: false, savings: '20% off' },
        { id: 4, credits: 5000, price: 350, bonus: 1000, popular: false, savings: '30% off' }
      ];
    }
  } catch (e) {
    // Ignore errors, dùng defaults an toàn
    configs.payment = configs.payment || {};
    configs.payment.payment_credit_per_usd = configs.payment.payment_credit_per_usd || 10;
    // Fallback should also use exact match
    configs.payment.payment_show_buy_credits = configs.payment.payment_show_buy_credits === true;
    configs.payment.payment_show_crypto_payment = configs.payment.payment_show_crypto_payment === true;
    configs.payment.min_deposit_amount = configs.payment.min_deposit_amount || 10;
    configs.payment.max_deposit_amount = configs.payment.max_deposit_amount || 10000;
    configs.payment.payment_credit_packages = configs.payment.payment_credit_packages || [
      { id: 1, credits: 100, price: 10, bonus: 0, popular: false, savings: '' },
      { id: 2, credits: 500, price: 45, bonus: 50, popular: true, savings: '10% off' },
      { id: 3, credits: 1000, price: 80, bonus: 200, popular: false, savings: '20% off' },
      { id: 4, credits: 5000, price: 350, bonus: 1000, popular: false, savings: '30% off' }
    ];
  }

  return res.json({ success: true, data: configs });
};

// Public: get active pricing tiers (auto seed defaults if empty)
exports.getPricingTiersPublic = async (req, res) => {
  try {
    // Check if there are any tiers
    const count = await PricingConfig.countDocuments();
    if (count === 0) {
      // Seed default tiers as yêu cầu: <=100: $1, <=1000: $10, <=10000: $100, <=100000: $1000, <=1000000: $10000, <=10000000: $100000, >10000000: $1000000
      const defaults = [
        { minCards: 1, maxCards: 100, total: 1 },
        { minCards: 101, maxCards: 1000, total: 10 },
        { minCards: 1001, maxCards: 10000, total: 100 },
        { minCards: 10001, maxCards: 100000, total: 1000 },
        { minCards: 100001, maxCards: 1000000, total: 10000 },
        { minCards: 1000001, maxCards: 10000000, total: 100000 },
        { minCards: 10000001, maxCards: null, total: 1000000 }
      ];
      // Lưu dưới dạng pricePerCard = total / (maxCards hoặc 100 cho mức đầu, hoặc minCards nếu max null tạm dùng minCards)
      await PricingConfig.insertMany(
        defaults.map(t => ({
          name: `${t.minCards}-${t.maxCards ?? '∞'} Cards Tier`,
          minCards: t.minCards,
          maxCards: t.maxCards === null ? null : t.maxCards,
          // Tính đơn giá trên mỗi thẻ để dùng chung hệ thống, chỉ để phục vụ hiển thị tổng giá theo bảng tier
          pricePerCard: t.maxCards ? (t.total / t.maxCards) : (t.total / t.minCards),
          discountPercentage: 0,
          isActive: true,
          priority: 0,
          applicableUserRoles: ['user']
        }))
      );
    }

    // Lấy danh sách active tiers, sắp xếp theo minCards tăng dần
    const tiers = await PricingConfig.getActivePricingTiers('user');

    // Chuyển sang dạng public, phản ánh trực tiếp dữ liệu DB:
    // - total = pricePerCard * maxCards (nếu max có), làm tròn số
    // - với max = null (∞), trả về pricePerCard để FE hiển thị "/card"
    const displayTiers = tiers.map(t => {
      const hasMax = t.maxCards !== null && typeof t.maxCards === 'number';
      return {
        min: t.minCards,
        max: hasMax ? t.maxCards : null,
        pricePerCard: Number(t.pricePerCard || 0),
        total: hasMax ? Math.round(Number(t.pricePerCard || 0) * Number(t.maxCards)) : null
      };
    });

    res.json({ success: true, data: { tiers: displayTiers } });
  } catch (error) {
    logger.error('Get public pricing tiers error:', error);
    res.status(500).json({ success: false, message: 'Failed to get pricing tiers', error: error.message });
  }
};

// GET /api/config/credit-packages - Unified endpoint for credit packages
exports.getCreditPackages = async (req, res) => {
  try {
    // Get credit packages from SiteConfig
    const creditPackagesConfig = await SiteConfig.findOne({ key: 'payment_credit_packages' });
    const creditPerUsdConfig = await SiteConfig.findOne({ key: 'payment_credit_per_usd' });

    const creditPackages = creditPackagesConfig?.value || [];
    const creditPerUsd = creditPerUsdConfig?.value || 10;

    // If no packages exist, create defaults
    if (creditPackages.length === 0) {
      const defaultPackages = [
        { id: 1, name: 'Starter', credits: 100, price: 10, popular: false },
        { id: 2, name: 'Basic', credits: 500, price: 45, popular: true },
        { id: 3, name: 'Pro', credits: 1000, price: 80, popular: false },
        { id: 4, name: 'Enterprise', credits: 5000, price: 350, popular: false }
      ];

      await SiteConfig.findOneAndUpdate(
        { key: 'payment_credit_packages' },
        { value: defaultPackages },
        { upsert: true }
      );

      return res.json({
        success: true,
        data: {
          packages: defaultPackages,
          creditPerUsd
        }
      });
    }

    res.json({
      success: true,
      data: {
        packages: creditPackages,
        creditPerUsd
      }
    });
  } catch (error) {
    // Trả về defaults an toàn thay vì 500 để frontend vẫn hoạt động
    logger.warn('Get credit packages error, fallback defaults:', error?.message || error);
    const defaultPackages = [
      { id: 1, name: 'Starter', credits: 100, price: 10, popular: false },
      { id: 2, name: 'Basic', credits: 500, price: 45, popular: true },
      { id: 3, name: 'Pro', credits: 1000, price: 80, popular: false },
      { id: 4, name: 'Enterprise', credits: 5000, price: 350, popular: false }
    ];
    return res.json({
      success: true,
      data: {
        packages: defaultPackages,
        creditPerUsd: 10
      }
    });
  }
};
