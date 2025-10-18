'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '@/lib/api';

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, params?: Record<string, any>) => string;
  showLanguageSwitcher?: boolean;
  availableLanguages?: string[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Translation data
const translations = {
  en: {
    common: {
      login: 'Login',
      logout: 'Logout',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      import: 'Import',
      refresh: 'Refresh',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      submit: 'Submit',
      reset: 'Reset',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
      welcome: 'Welcome',
      getStarted: 'Get Started',
      beta: 'Beta'
    },
    auth: {
      loginTitle: 'Login',
      loginSubtitle: 'Enter your login information or try the system',
      usernameOrEmail: 'Username or Email',
      password: 'Password',
      loginButton: 'Login',
      noAccount: "Don't have an account?",
      registerNow: 'Register now',
      backToHome: '← Back to home',
      demoAccounts: 'Demo accounts:',
      admin: 'Admin',
      user: 'User',
      loginError: 'Login failed',
      tooManyAttempts: 'Too many authentication attempts, please try again later',
      invalidCredentials: 'Invalid email or password',
      registerTitle: 'Register',
      registerSubtitle: 'Create a new account to use the system',
      username: 'Username',
      email: 'Email',
      confirmPassword: 'Confirm Password',
      registerButton: 'Register',
      alreadyHaveAccount: 'Already have an account?',
      loginNow: 'Login now',
      logoutSuccess: 'Logout successful',
      logoutError: 'Logout failed',
      validation: {
        emailRequired: 'Please enter complete information',
        usernameRequired: 'Username is required',
        passwordRequired: 'Password is required',
        confirmPasswordRequired: 'Confirm password is required',
        passwordMismatch: 'Passwords do not match',
        invalidEmail: 'Invalid email format',
        passwordTooShort: 'Password must be at least 8 characters',
        usernameExists: 'Username already exists',
        emailExists: 'Email already exists'
      }
    },
    success: {
      loginSuccess: 'Login successful!'
    },
    home: {
      title: 'Credit Card Checker',
      subtitle: 'Professional credit card checking system',
      heroTitle: 'Check credit cards safely & quickly',
      heroDescription: 'Credit card checking and management system with advanced security technology, helping you verify card validity accurately and safely.',
      getStarted: 'Get Started',
      learnMore: 'Learn More',
      featuresTitle: 'Outstanding Features',
      featuresSubtitle: 'The system is designed with advanced features to meet all credit card checking and management needs.',
      ctaTitle: 'Ready to get started?',
      ctaSubtitle: 'Join thousands of users who trust our credit card checking system.',
      ctaButton: 'Register for free',
      features: {
        cardCheck: {
          title: 'Credit Card Checking',
          description: 'Check credit card validity and status quickly and accurately'
        },
        security: {
          title: 'High Security',
          description: 'Multi-layer security system with end-to-end encryption and 2FA authentication'
        },
        speed: {
          title: 'Fast Processing',
          description: 'Batch check cards at high speed with instant results'
        },
        analytics: {
          title: 'Detailed Analytics',
          description: 'Comprehensive reports and analysis of card checking performance'
        },
        userManagement: {
          title: 'User Management',
          description: 'Flexible user management system with role-based permissions'
        },
        compliance: {
          title: 'Regulatory Compliance',
          description: 'Ensure compliance with security and privacy regulations'
        }
      },
      stats: {
        cardsChecked: 'Cards Checked',
        trustedUsers: 'Trusted Users',
        accuracy: 'Accuracy',
        uptime: 'Uptime'
      },
      footer: {
        copyright: '© 2024 Credit Card Checker. All rights reserved.'
      }
    },
    dashboard: {
      title: 'Dashboard',
      navigation: {
        sections: {
          tools: 'TOOLS',
          shop: 'SHOP',
          support: 'SUPPORT',
          legal: 'LEGAL'
        },
        items: {
          home: 'Home',
          checker: 'Check Credit Card',
          cardGenerator: 'Generate Cards',
          apiDocs: 'API Documentation',
          buyCredits: 'Buy Credits',
          paymentCreditsAuto: 'Payment Credits Auto',
          telegramSupport: 'Telegram Support',
          faq: 'FAQ',
          terms: 'Terms of Service'
        }
      },
      stats: {
        totalChecked: 'Total Checked',
        successRate: 'Success Rate',
        avgResponseTime: 'Avg Response Time',
        activeUsers: 'Active Users',
        todayChecked: 'Today Checked',
        thisWeekChecked: 'This Week Checked',
        thisMonthChecked: 'This Month Checked',
        totalRevenue: 'Total Revenue'
      },
      recentActivity: 'Recent Activity',
      quickActions: 'Quick Actions',
      systemStatus: 'System Status'
    },
    checker: {
      title: 'Credit Card Checker',
      description: 'Validate credit cards quickly and reliably',
      subtitle: 'Check credit card validity and status',
      formatInfo: 'Format: XXXXXXXXXXXXXXXX|MM|YYYY|CVV (one per line)',
      inputLabel: 'Credit Cards',
      inputPlaceholder: 'Enter credit cards in format: XXXXXXXXXXXXXXXX|MM|YYYY|CVV\nOne card per line',
      startCheck: 'Start Checking',
      stopCheck: 'Stop Checking',
      clearAll: 'Clear All',
      filterButton: 'Filter Results',
      copyResults: 'Copy Results',
      downloadResults: 'Download Results',
      filterAll: 'All',
      filterLive: 'Live',
      filterDead: 'Dead',
      filterError: 'Error',
      filterUnknown: 'Unknown',
      stats: {
        total: 'Total',
        live: 'Live',
        dead: 'Dead',
        error: 'Error',
        unknown: 'Unknown',
        progress: 'Progress',
        speed: 'Check Speed',
        checkSpeed: 'Check Speed',
        liveRate: 'Live Rate',
        successRate: 'Success Rate',
        checking: 'Checking',
        processed: 'Checked',
        remaining: 'Remaining',
        cards: 'cards',
        lines: 'lines'
      },
      status: {
        live: 'Live',
        dead: 'Dead',
        error: 'Error',
        unknown: 'Unknown'
      },
      pricing: {
        title: 'Pricing Table',
        description: 'Pay by number of cards',
        upTo: 'Up to',
        cards: 'cards',
        loading: 'Loading pricing...'
      },
      messages: {
        enterCards: 'Please paste cards to check',
        invalidFormat: 'Invalid card format',
        checkingComplete: 'Checking completed',
        checkingStarted: 'Started checking',
        noCards: 'Please enter credit cards to check',
        copied: 'Copied'
      },
      info: {
        title: 'Information',
        balance: 'Balance',
        pricePerCard: 'Price/Card',
        estimatedCost: 'Estimated Cost'
      },
      results: {
        title: 'Results'
      },
      noData: 'No data available'
    },

    // API Docs page
    apiDocs: {
      title: 'API Documentation',
      description: 'Integrate our services via REST API with secure authentication and clear examples'
    },

    // Buy Credits page
    buyCredits: {
      title: 'Buy Credits',
      description: 'Purchase credits to use card checking and generation services',
      currentBalance: 'Current Balance',
      methodsTitle: 'Payment Methods',
      methodsDesc: 'Choose your preferred payment method',
      processing: 'Processing...',
      securePurchase: 'Secure Purchase',
      transactionHistory: {
        title: 'Transaction History',
        description: 'Your recent credit purchases',
        empty: 'No top-up requests yet'
      },
      modal: {
        title: 'Payment Instructions',
        cancel: 'Cancel',
        confirm: 'I have transferred',
        sending: 'Sending...',
        timeLeft: 'Time left',
        bankName: 'Bank',
        accountName: 'Account Name',
        accountNumber: 'Account No./Wallet',
        amount: 'Amount',
        instructions: 'Instructions',
        noQR: 'No QR code',
        waitingApproval: 'Request created. Please wait for approval.'
      }
    },

    // Crypto Payment page
    cryptoPayment: {
      title: 'Top up with Cryptocurrency',
      subtitle: 'Choose a credit package and pay with Bitcoin, Ethereum, USDT or other coins',

      choosePackage: 'Choose Credit Package',
      choosePackageDesc: 'Select a package or enter a custom amount',
      popular: 'Popular',
      savings: 'Save {{percent}}',

      customAmount: 'Custom amount',
      customAmountPlaceholder: 'Enter USD amount (min $1)',
      willReceive: 'You will receive {{credits}} credits',

      chooseCrypto: 'Choose Crypto',
      summary: 'Order Summary',
      amount: 'Amount',
      creditsReceive: 'Credits to receive',
      method: 'Method',
      total: 'Total',
      estimatedCryptoAmount: 'Est. {{coin}} to pay (based on exchange rate)',
      estimatedCryptoAmount: 'Estimated crypto to pay (based on exchange rate)',

      creating: 'Creating...',
      createAddress: 'Create payment address',

      currentBalance: 'Current Balance',
      balanceNotice: 'Balance will be updated after successful payment',

      payTitle: 'Cryptocurrency Payment',
      payDescription: 'Complete the payment to top-up {{credits}} credits to your account',
      paymentInfo: 'Payment Information',
      sendTo: 'Send {{label}} to the address below',
      status: 'Status:',
      statusPaid: 'Paid',
      statusPending: 'Pending',
      timeLeft: 'Time left:',
      receiveAddress: 'Receive address ({{coin}})',
      amountUSD: 'Amount (USD)',
      minimumAmount: 'Minimum amount:',
      instructions: 'Instructions',
      newPayment: 'Create new payment',
      qrCode: 'QR Code',
      qrDesc: 'Scan the QR code to pay quickly',
      scanWithWallet: 'Scan with your crypto wallet',
      orderId: 'Order ID:',

      toasts: {
        createdTitle: 'Payment address created',
        createdDesc: 'Please send funds to the provided address',
        successTitle: 'Payment successful!',
        successDesc: 'Your balance has been updated.',
        errorTitle: 'Error',
        minAmount: 'Minimum amount is $1',
        createError: 'Failed to create payment',
        copiedTitle: 'Copied',
        copiedDesc: 'Address copied to clipboard',
        copyError: 'Cannot copy address'
      },
    },


    // FAQ page
    faq: {
      title: 'Frequently Asked Questions',
      description: 'Find answers to common questions about our services',
      searchPlaceholder: 'Search questions...'
    },

    // Generate page (alias keys used by UI)
    generate: {
      title: 'Credit Card Generator',
      description: 'Generate valid test cards quickly',
      binLabel: 'BIN (Bank Identification Number)',
      binPlaceholder: 'Enter 6-8 digits (e.g., 4532, 5555)',
      quantityLabel: 'Quantity',
      monthLabel: 'Expiry Month',
      yearLabel: 'Expiry Year',
      generateButton: 'Generate Cards',
      clearButton: 'Clear All',
      randomOption: 'Random'
    },

    // Terms page
    terms: {
      title: 'Terms of Service',
      description: 'Please read the terms and conditions of using our services'
    },

    // Settings page (user dashboard)
    settings: {
      title: 'Settings',
      description: 'Manage your profile and security settings',
      profile: {
        title: 'Profile Information',
        description: 'Update your personal information and avatar',
        avatar: 'Profile Avatar',
        uploadAvatar: 'Click or drag to upload avatar',
        username: 'Username',
        email: 'Email',
        bio: 'Bio',
        bioPlaceholder: 'Write something about yourself...'
      },
      security: {
        title: 'Security',
        description: 'Change your password to keep your account secure',
        currentPassword: 'Current Password',
        newPassword: 'New Password',
        confirmPassword: 'Confirm New Password',
        passwordRequirements: 'Password must be at least 8 characters'
      },
      actions: {
        save: 'Save Changes',
        saving: 'Saving...'
      },
      messages: {
        profileUpdated: 'Profile updated successfully',
        profileUpdateError: 'Failed to update profile'
      }
    },

    generator: {
      title: 'Credit Card Generator',
      subtitle: 'Generate valid credit cards for testing purposes',
      form: {
        binLabel: 'BIN (Bank Identification Number)',
        binPlaceholder: 'Enter 6-8 digits (e.g., 4532, 5555)',
        quantityLabel: 'Quantity',
        quantityPlaceholder: 'Number of cards to generate',
        monthLabel: 'Expiry Month',
        yearLabel: 'Expiry Year',
        generateButton: 'Generate Cards',
        clearButton: 'Clear All',
        downloadButton: 'Download',
        copyButton: 'Copy All'
      },
      options: {
        random: 'Random',
        custom: 'Custom'
      },
      stats: {
        generated: 'Generated',
        brands: 'Brands',
        format: 'Format'
      },
      messages: {
        invalidBin: 'Invalid BIN format',
        generationComplete: 'Cards generated successfully',
        copied: 'Cards copied to clipboard',
        downloaded: 'Cards downloaded successfully',
        noCards: 'No cards to copy/download',
        maxQuantity: 'Maximum 100 cards allowed'
      }
    },
  },
  vi: {
    common: {
      login: 'Đăng nhập',
      logout: 'Đăng xuất',
      loading: 'Đang tải...',
      error: 'Lỗi',
      success: 'Thành công',
      save: 'Lưu',
      cancel: 'Hủy',
      delete: 'Xóa',
      edit: 'Sửa',
      add: 'Thêm',
      search: 'Tìm kiếm',
      filter: 'Lọc',
      export: 'Xuất',
      import: 'Nhập',
      refresh: 'Làm mới',
      back: 'Quay lại',
      next: 'Tiếp theo',
      previous: 'Trước',
      submit: 'Gửi',
      reset: 'Đặt lại',
      confirm: 'Xác nhận',
      yes: 'Có',
      no: 'Không',
      welcome: 'Chào mừng',
      getStarted: 'Bắt đầu ngay',
      beta: 'Beta'
    },
    auth: {
      loginTitle: 'Đăng nhập',
      loginSubtitle: 'Nhập thông tin đăng nhập để truy cập hệ thống',
      usernameOrEmail: 'Tên đăng nhập hoặc Email',
      password: 'Mật khẩu',
      loginButton: 'Đăng nhập',
      noAccount: 'Chưa có tài khoản?',
      registerNow: 'Đăng ký ngay',
      backToHome: '← Quay về trang chủ',
      demoAccounts: 'Tài khoản demo:',
      admin: 'Admin',
      user: 'User',
      loginError: 'Đăng nhập thất bại',
      tooManyAttempts: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau',
      invalidCredentials: 'Email hoặc mật khẩu không đúng',
      registerTitle: 'Đăng ký',
      registerSubtitle: 'Tạo tài khoản mới để sử dụng hệ thống',
      username: 'Tên đăng nhập',
      email: 'Email',
      confirmPassword: 'Xác nhận mật khẩu',
      registerButton: 'Đăng ký',
      alreadyHaveAccount: 'Đã có tài khoản?',
      loginNow: 'Đăng nhập ngay',
      logoutSuccess: 'Đăng xuất thành công',
      logoutError: 'Đăng xuất thất bại',
      validation: {
        emailRequired: 'Vui lòng nhập đầy đủ thông tin',
        usernameRequired: 'Tên đăng nhập là bắt buộc',
        passwordRequired: 'Mật khẩu là bắt buộc',
        confirmPasswordRequired: 'Xác nhận mật khẩu là bắt buộc',
        passwordMismatch: 'Mật khẩu không khớp',
        invalidEmail: 'Định dạng email không hợp lệ',
        passwordTooShort: 'Mật khẩu phải có ít nhất 8 ký tự',
        usernameExists: 'Tên đăng nhập đã tồn tại',
        emailExists: 'Email đã tồn tại'
      }
    },
    success: {
      loginSuccess: 'Đăng nhập thành công!'
    },
    home: {
      title: 'Credit Card Checker',
      subtitle: 'Hệ thống kiểm tra thẻ tín dụng chuyên nghiệp',
      heroTitle: 'Kiểm tra thẻ tín dụng an toàn & nhanh chóng',
      heroDescription: 'Hệ thống kiểm tra và quản lý thẻ tín dụng với công nghệ bảo mật tiên tiến, giúp bạn xác minh tính hợp lệ của thẻ một cách chính xác và an toàn.',
      getStarted: 'Bắt đầu ngay',
      learnMore: 'Tìm hiểu thêm',
      featuresTitle: 'Tính năng nổi bật',
      featuresSubtitle: 'Hệ thống được thiết kế với các tính năng tiên tiến để đáp ứng mọi nhu cầu kiểm tra và quản lý thẻ tín dụng.',
      ctaTitle: 'Sẵn sàng bắt đầu?',
      ctaSubtitle: 'Tham gia cùng hàng nghìn người dùng đang tin tưởng sử dụng hệ thống kiểm tra thẻ tín dụng của chúng tôi.',
      ctaButton: 'Đăng ký miễn phí',
      features: {
        cardCheck: {
          title: 'Kiểm tra thẻ tín dụng',
          description: 'Kiểm tra tính hợp lệ và trạng thái của thẻ tín dụng một cách nhanh chóng và chính xác'
        },
        security: {
          title: 'Bảo mật cao',
          description: 'Hệ thống bảo mật đa lớp với mã hóa end-to-end và xác thực 2FA'
        },
        speed: {
          title: 'Xử lý nhanh',
          description: 'Kiểm tra hàng loạt thẻ với tốc độ cao và kết quả tức thì'
        },
        analytics: {
          title: 'Thống kê chi tiết',
          description: 'Báo cáo và phân tích chi tiết về hiệu suất kiểm tra thẻ'
        },
        userManagement: {
          title: 'Quản lý người dùng',
          description: 'Hệ thống quản lý người dùng với phân quyền linh hoạt'
        },
        compliance: {
          title: 'Tuân thủ quy định',
          description: 'Đảm bảo tuân thủ các quy định bảo mật và quyền riêng tư'
        }
      },
      stats: {
        cardsChecked: 'Thẻ đã kiểm tra',
        trustedUsers: 'Người dùng tin tưởng',
        accuracy: 'Độ chính xác',
        uptime: 'Thời gian hoạt động'
      },
      footer: {
        copyright: '© 2024 Credit Card Checker. Tất cả quyền được bảo lưu.'
      }
    },
    dashboard: {
      title: 'Bảng điều khiển',
      navigation: {
        sections: {
          tools: 'CÔNG CỤ',
          shop: 'CỬA HÀNG',
          support: 'HỖ TRỢ',
          legal: 'PHÁP LÝ'
        },
        items: {
          home: 'Trang chủ',
          checker: 'Kiểm tra thẻ tín dụng',
          cardGenerator: 'Tạo thẻ',
          apiDocs: 'Tài liệu API',
          buyCredits: 'Mua tín dụng',
          paymentCreditsAuto: 'Payment Credits Auto',
          telegramSupport: 'Hỗ trợ Telegram',
          faq: 'Câu hỏi thường gặp',
          terms: 'Điều khoản dịch vụ'
        }
      },
      stats: {
        totalChecked: 'Tổng số đã kiểm tra',
        successRate: 'Tỷ lệ thành công',
        avgResponseTime: 'Thời gian phản hồi TB',
        activeUsers: 'Người dùng hoạt động',
        todayChecked: 'Hôm nay đã kiểm tra',
        thisWeekChecked: 'Tuần này đã kiểm tra',
        thisMonthChecked: 'Tháng này đã kiểm tra',
        totalRevenue: 'Tổng doanh thu'
      },
      recentActivity: 'Hoạt động gần đây',
      quickActions: 'Thao tác nhanh',
      systemStatus: 'Trạng thái hệ thống'
    },
    checker: {
      title: 'Kiểm tra thẻ tín dụng',
      description: 'Xác thực thẻ tín dụng nhanh và chính xác',
      subtitle: 'Kiểm tra tính hợp lệ và trạng thái của thẻ tín dụng',
      formatInfo: 'Định dạng: XXXXXXXXXXXXXXXX|MM|YYYY|CVV (mỗi dòng một thẻ)',
      inputLabel: 'Thẻ tín dụng',
      inputPlaceholder: 'Nhập thẻ tín dụng theo định dạng: XXXXXXXXXXXXXXXX|MM|YYYY|CVV\nMỗi thẻ một dòng',
      startCheck: 'Bắt đầu kiểm tra',
      stopCheck: 'Dừng kiểm tra',
      clearAll: 'Xóa tất cả',
      filterButton: 'Lọc kết quả',
      copyResults: 'Sao chép kết quả',
      downloadResults: 'Tải xuống kết quả',
      filterAll: 'Tất cả',
      filterLive: 'Live',
      filterDead: 'Dead',
      filterError: 'Lỗi',
      filterUnknown: 'Không xác định',
      stats: {
        total: 'Tổng cộng',
        live: 'Live',
        dead: 'Dead',
        error: 'Lỗi',
        unknown: 'Không xác định',
        progress: 'Tiến trình',
        speed: 'Tốc độ kiểm tra',
        checkSpeed: 'Tốc độ kiểm tra',
        liveRate: 'Tỷ lệ Live',
        successRate: 'Tỷ lệ thành công',
        checking: 'Đang kiểm tra',
        processed: 'Đã kiểm tra',
        remaining: 'Còn lại',
        cards: 'thẻ',
        lines: 'dòng'
      },
      status: {
        live: 'Live',
        dead: 'Dead',
        error: 'Lỗi',
        unknown: 'Không xác định'
      },
      pricing: {
        title: 'Bảng giá',
        description: 'Trả tiền theo số lượng thẻ',
        upTo: 'Tối đa',
        cards: 'thẻ',
        loading: 'Đang tải bảng giá...'
      },
      messages: {
        enterCards: 'Vui lòng dán thẻ để kiểm tra',
        invalidFormat: 'Định dạng thẻ không hợp lệ',
        checkingComplete: 'Kiểm tra hoàn tất',
        checkingStarted: 'Đã bắt đầu kiểm tra',
        noCards: 'Vui lòng nhập thẻ tín dụng để kiểm tra',
        copied: 'Đã copy'
      },
      info: {
        title: 'Thông tin',
        balance: 'Số dư',
        pricePerCard: 'Giá/Thẻ',
        estimatedCost: 'Ước tính chi phí'
      },
      results: {
        title: 'Kết quả'
      },
      noData: 'Chưa có dữ liệu'
    },

    // API Docs page
    apiDocs: {
      title: 'Tài liệu API',
      description: 'Tích hợp dịch vụ qua REST API với xác thực an toàn và ví dụ rõ ràng'
    },

    // Buy Credits page
    buyCredits: {
      title: 'Mua tín dụng',
      description: 'Mua tín dụng để sử dụng dịch vụ kiểm tra và tạo thẻ',
      currentBalance: 'Số dư hiện tại',
      methodsTitle: 'Phương thức thanh toán',
      methodsDesc: 'Chọn phương thức thanh toán bạn muốn dùng',
      processing: 'Đang xử lý...',
      securePurchase: 'Thanh toán an toàn',
      transactionHistory: {
        title: 'Lịch sử giao dịch',
        description: 'Các yêu cầu nạp tiền gần đây của bạn',
        empty: 'Chưa có yêu cầu nạp tiền nào'
      },
      modal: {
        title: 'Hướng dẫn thanh toán',
        cancel: 'Hủy bỏ',
        confirm: 'Đã chuyển tiền',
        sending: 'Đang gửi...',
        timeLeft: 'Thời gian còn lại',
        bankName: 'Ngân hàng',
        accountName: 'Chủ TK',
        accountNumber: 'Số TK/Ví',
        amount: 'Số tiền',
        instructions: 'Hướng dẫn',
        noQR: 'Không có QR code',
        waitingApproval: 'Đã tạo yêu cầu nạp tiền, vui lòng chờ duyệt'
      }
    },

    // FAQ page
    faq: {
      title: 'Câu hỏi thường gặp',
      description: 'Các câu hỏi phổ biến về dịch vụ',
      searchPlaceholder: 'Tìm kiếm câu hỏi...'
    },

    // Generate page (alias keys used by UI)
    generate: {
      title: 'Trình tạo thẻ tín dụng',
      description: 'Tạo nhanh các thẻ test hợp lệ',
      binLabel: 'BIN (Mã định danh ngân hàng)',
      binPlaceholder: 'Nhập 6-8 chữ số (ví dụ: 4532, 5555)',
      quantityLabel: 'Số lượng',
      monthLabel: 'Tháng hết hạn',
      yearLabel: 'Năm hết hạn',
      generateButton: 'Tạo thẻ',
      clearButton: 'Xóa tất cả',
      randomOption: 'Ngẫu nhiên'
    },

    // Terms page
    terms: {
      title: 'Điều khoản dịch vụ',
      description: 'Vui lòng đọc kỹ các điều khoản sử dụng dịch vụ của chúng tôi'
    },

    // Settings page (user dashboard)
    settings: {
      title: 'Cài đặt',
      description: 'Quản lý hồ sơ cá nhân và bảo mật tài khoản',
      profile: {
        title: 'Thông tin hồ sơ',
        description: 'Cập nhật thông tin cá nhân và ảnh đại diện',
        avatar: 'Ảnh đại diện',
        uploadAvatar: 'Nhấn hoặc kéo thả để tải ảnh đại diện',
        username: 'Tên đăng nhập',
        email: 'Email',
        bio: 'Giới thiệu',
        bioPlaceholder: 'Viết đôi điều về bạn...'
      },
      security: {
        title: 'Bảo mật',
        description: 'Đổi mật khẩu để bảo vệ tài khoản của bạn',
        currentPassword: 'Mật khẩu hiện tại',
        newPassword: 'Mật khẩu mới',
        confirmPassword: 'Xác nhận mật khẩu mới',
        passwordRequirements: 'Mật khẩu phải có ít nhất 8 ký tự'
      },
      actions: {
        save: 'Lưu thay đổi',
        saving: 'Đang lưu...'
      },
      messages: {
        profileUpdated: 'Cập nhật hồ sơ thành công',
        profileUpdateError: 'Cập nhật hồ sơ thất bại'
      }
    },

    // Crypto Payment page
    cryptoPayment: {
      title: 'Nạp tiền bằng Cryptocurrency',
      subtitle: 'Chọn gói credits và thanh toán bằng Bitcoin, Ethereum, USDT hoặc các loại coin khác',

      choosePackage: 'Chọn gói Credits',
      choosePackageDesc: 'Chọn gói có sẵn hoặc nhập số tiền tùy chỉnh',
      popular: 'Phổ biến',
      savings: 'Tiết kiệm {{percent}}',

      customAmount: 'Số tiền tùy chỉnh',
      customAmountPlaceholder: 'Nhập số tiền USD (tối thiểu $1)',
      willReceive: 'Bạn sẽ nhận được {{credits}} credits',

      chooseCrypto: 'Chọn loại Crypto',
      summary: 'Tóm tắt đơn hàng',
      amount: 'Số tiền',
      creditsReceive: 'Credits nhận được',
      method: 'Phương thức',
      total: 'Tổng cộng',
      estimatedCryptoAmount: 'Số {{coin}} cần thanh toán (ước tính theo tỷ giá)',

      creating: 'Đang tạo...',
      createAddress: 'Tạo địa chỉ thanh toán',

      currentBalance: 'Số dư hiện tại',
      balanceNotice: 'Số dư sẽ được cập nhật sau khi thanh toán thành công',

      payTitle: 'Thanh toán bằng Cryptocurrency',
      payDescription: 'Hoàn tất thanh toán để nạp {{credits}} credits vào tài khoản của bạn',
      paymentInfo: 'Thông tin thanh toán',
      sendTo: 'Chuyển {{label}} đến địa chỉ bên dưới',
      status: 'Trạng thái:',
      statusPaid: 'Đã thanh toán',
      statusPending: 'Chờ thanh toán',
      timeLeft: 'Thời gian còn lại:',
      receiveAddress: 'Địa chỉ nhận ({{coin}})',
      amountUSD: 'Số tiền (USD)',
      minimumAmount: 'Số tiền tối thiểu:',
      instructions: 'Hướng dẫn',
      newPayment: 'Tạo thanh toán mới',
      qrCode: 'QR Code',
      qrDesc: 'Quét mã QR để thanh toán nhanh',
      scanWithWallet: 'Quét bằng ví crypto của bạn',
      orderId: 'Mã đơn hàng:',

      toasts: {
        createdTitle: 'Đã tạo địa chỉ thanh toán',
        createdDesc: 'Vui lòng chuyển tiền tới địa chỉ đã cung cấp',
        successTitle: 'Thanh toán thành công!',
        successDesc: 'Số dư của bạn đã được cập nhật.',
        errorTitle: 'Lỗi',
        minAmount: 'Số tiền tối thiểu là $1',
        createError: 'Tạo thanh toán thất bại',
        copiedTitle: 'Đã sao chép',
        copiedDesc: 'Đã sao chép địa chỉ vào clipboard',
        copyError: 'Không thể sao chép địa chỉ'
      }
    },

    generator: {
      title: 'Tạo thẻ tín dụng',
      subtitle: 'Tạo thẻ tín dụng hợp lệ cho mục đích test',
      form: {
        binLabel: 'BIN (Mã định danh ngân hàng)',
        binPlaceholder: 'Nhập 6-8 chữ số (ví dụ: 4532, 5555)',
        quantityLabel: 'Số lượng',
        quantityPlaceholder: 'Số thẻ cần tạo',
        monthLabel: 'Tháng hết hạn',
        yearLabel: 'Năm hết hạn',
        generateButton: 'Tạo thẻ',
        clearButton: 'Xóa tất cả',
        downloadButton: 'Tải xuống',
        copyButton: 'Sao chép tất cả'
      },
      options: {
        random: 'Ngẫu nhiên',
        custom: 'Tùy chỉnh'
      },
      stats: {
        generated: 'Đã tạo',
        brands: 'Thương hiệu',
        format: 'Định dạng'
      },
      messages: {
        invalidBin: 'Định dạng BIN không hợp lệ',
        generationComplete: 'Tạo thẻ thành công',
        copied: 'Đã sao chép thẻ vào clipboard',
        downloaded: 'Đã tải xuống thẻ thành công',
        noCards: 'Không có thẻ để sao chép/tải xuống',
        maxQuantity: 'Tối đa 100 thẻ được phép'
      }
    }
  },
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('en'); // default
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(true);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(['en','vi']);

  useEffect(() => {
    const init = async () => {
      try {
        // 1) Load user preference if any
        const saved = typeof window !== 'undefined' ? localStorage.getItem('language') : null;
        // 2) Load defaults from public config
        const resp = await apiClient.get('/config/public');
        const data = resp.data?.data || {};
        const ui = data.ui || {};
        const defLang = ui.ui_default_language || 'en';
        const showSwitcher = ui.ui_language_switcher_enabled !== undefined ? ui.ui_language_switcher_enabled : true;
        const langs = Array.isArray(ui.ui_available_languages) && ui.ui_available_languages.length > 0 ? ui.ui_available_languages : ['en','vi'];
        setShowLanguageSwitcher(!!showSwitcher);
        setAvailableLanguages(langs);
        setLanguageState(saved || defLang);
      } catch (e) {
        // fallback to defaults
        const saved = typeof window !== 'undefined' ? localStorage.getItem('language') : null;
        setLanguageState(saved || 'en');
        setShowLanguageSwitcher(true);
        setAvailableLanguages(['en','vi']);
      }
    };
    init();
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
  };

  const t = (key: string, params: Record<string, any> = {}) => {
    const keys = key.split('.');
    let value: any = translations[language as keyof typeof translations];

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') {
      // Fallback to English if translation not found
      value = translations.en;
      for (const k of keys) {
        value = value?.[k];
      }
    }

    if (typeof value !== 'string') {
      return key; // Return key if no translation found
    }

    // Replace parameters
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey] || match;
    });
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, showLanguageSwitcher, availableLanguages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
