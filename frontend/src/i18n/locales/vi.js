export default {
  // Common
  common: {
    login: 'Đăng nhập',
    logout: 'Đăng xuất',
    register: 'Đăng ký',
    email: 'Email',
    password: 'Mật khẩu',
    confirmPassword: 'Xác nhận mật khẩu',
    fullName: 'Họ và tên',
    submit: 'Gửi',
    cancel: 'Hủy',
    save: 'Lưu',
    edit: 'Sửa',
    delete: 'Xóa',
    search: 'Tìm kiếm',
    loading: 'Đang tải...',
    error: 'Lỗi',
    success: 'Thành công',
    warning: 'Cảnh báo',
    info: 'Thông tin',
    close: 'Đóng',
    back: 'Quay lại',
    next: 'Tiếp theo',
    previous: 'Trước',
    home: 'Trang chủ',
    dashboard: 'Bảng điều khiển',
    profile: 'Hồ sơ',
    settings: 'Cài đặt',
    language: 'Ngôn ngữ',
    welcome: 'Chào mừng',
    getStarted: 'Bắt đầu'
  },

  // Navigation
  nav: {
    home: 'Trang chủ',
    about: 'Giới thiệu',
    contact: 'Liên hệ',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    dashboard: 'Bảng điều khiển',
    profile: 'Hồ sơ',
    logout: 'Đăng xuất'
  },

  // Auth
  auth: {
    login: 'Đăng nhập',
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
    invalidCredentials: 'Email hoặc mật khẩu không đúng',
    tooManyAttempts: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau',
    
    register: 'Đăng ký',
    registerTitle: 'Tạo tài khoản',
    registerSubtitle: 'Tạo tài khoản mới để bắt đầu sử dụng',
    fullName: 'Họ và tên',
    email: 'Email',
    confirmPassword: 'Xác nhận mật khẩu',
    registerButton: 'Tạo tài khoản',
    haveAccount: 'Đã có tài khoản?',
    loginNow: 'Đăng nhập ngay',
    
    // Validation messages
    validation: {
      emailRequired: 'Email là bắt buộc',
      emailInvalid: 'Vui lòng nhập email hợp lệ',
      passwordRequired: 'Mật khẩu là bắt buộc',
      passwordMinLength: 'Mật khẩu phải có ít nhất 6 ký tự',
      passwordsNotMatch: 'Mật khẩu không khớp',
      fullNameRequired: 'Họ và tên là bắt buộc',
      fullNameMinLength: 'Họ và tên phải có ít nhất 2 ký tự'
    }
  },

  // Dashboard
  dashboard: {
    title: 'Bảng điều khiển',
    welcome: 'Chào mừng trở lại, {{name}}!',
    overview: 'Tổng quan',
    recentActivity: 'Hoạt động gần đây',
    quickActions: 'Thao tác nhanh',
    statistics: 'Thống kê',
    systemStatus: 'Trạng thái hệ thống',

    // Stats
    stats: {
      totalChecked: 'Tổng số đã kiểm tra',
      successRate: 'Tỷ lệ thành công',
      avgResponseTime: 'Thời gian phản hồi TB',
      activeUsers: 'Người dùng hoạt động',
      todayChecked: 'Hôm nay đã kiểm tra'
    },

    // Navigation items
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
        buyCredits: 'Mua tín dụng',
        apiDocs: 'Tài liệu API',
        faq: 'Câu hỏi thường gặp',
        terms: 'Điều khoản dịch vụ',
        telegramSupport: 'Hỗ trợ Telegram'
      }
    }
  },

  // Profile
  profile: {
    title: 'Hồ sơ',
    personalInfo: 'Thông tin cá nhân',
    updateProfile: 'Cập nhật hồ sơ',
    changePassword: 'Đổi mật khẩu',
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmNewPassword: 'Xác nhận mật khẩu mới',
    updateSuccess: 'Cập nhật hồ sơ thành công',
    updateError: 'Cập nhật hồ sơ thất bại'
  },

  // Errors
  errors: {
    networkError: 'Lỗi mạng. Vui lòng kiểm tra kết nối.',
    serverError: 'Lỗi máy chủ. Vui lòng thử lại sau.',
    unauthorized: 'Bạn không có quyền truy cập tài nguyên này.',
    forbidden: 'Truy cập bị từ chối.',
    notFound: 'Không tìm thấy tài nguyên được yêu cầu.',
    validationError: 'Vui lòng kiểm tra thông tin nhập và thử lại.',
    unknownError: 'Đã xảy ra lỗi không xác định.'
  },

  // Success messages
  success: {
    loginSuccess: 'Đăng nhập thành công',
    registerSuccess: 'Tạo tài khoản thành công',
    profileUpdated: 'Cập nhật hồ sơ thành công',
    passwordChanged: 'Đổi mật khẩu thành công'
  },

  // Home page
  home: {
    title: 'Kiểm tra thẻ tín dụng',
    subtitle: 'Hệ thống kiểm tra thẻ tín dụng chuyên nghiệp',
    features: {
      cardCheck: {
        title: 'Kiểm tra thẻ tín dụng',
        description: 'Kiểm tra tính hợp lệ và trạng thái thẻ tín dụng nhanh chóng và chính xác'
      }
    }
  },

  // Checker page
  checker: {
    title: 'Kiểm tra thẻ tín dụng',
    description: 'Kiểm tra tính hợp lệ và trạng thái của thẻ tín dụng',
    inputPlaceholder: 'Nhập thẻ tín dụng theo định dạng:\nccnum|mm|yy|ccv\nccnum|mm|yyyy|ccv\n\nVí dụ:\n4532123456789012|12|25|123\n5555444433332222|01|2026|456',
    formatInfo: 'Định dạng hỗ trợ: ccnum|mm|yy|ccv hoặc ccnum|mm|yyyy|ccv',
    startCheck: 'Bắt đầu kiểm tra',
    stopCheck: 'Dừng kiểm tra',
    clearAll: 'Xóa tất cả',
    copyResults: 'Sao chép kết quả',
    downloadResults: 'Tải xuống kết quả',
    filterAll: 'Tất cả',
    filterLive: 'Live',
    filterDead: 'Dead',
    filterError: 'Lỗi',
    filterUnknown: 'Không xác định',
    noData: 'Không có dữ liệu',
    info: {
      title: 'Thông tin',
      balance: 'Số dư',
      pricePerCard: 'Giá mỗi thẻ',
      estimatedCost: 'Chi phí ước tính'
    },
    stats: {
      total: 'Tổng số',
      live: 'Live',
      dead: 'Dead',
      error: 'Lỗi',
      unknown: 'Không xác định',
      progress: 'Tiến độ',
      speed: 'Tốc độ',
      liveRate: 'Tỷ lệ Live',
      successRate: 'Tỷ lệ thành công',
      cards: 'thẻ',
      lines: 'dòng'
    },
    messages: {
      enterCards: 'Vui lòng nhập thẻ tín dụng để kiểm tra',
      invalidFormat: 'Định dạng thẻ không hợp lệ',
      checkingStarted: 'Bắt đầu kiểm tra thẻ',
      checkingStopped: 'Đã dừng kiểm tra',
      resultsCopied: 'Đã sao chép kết quả',
      resultsCleared: 'Đã xóa tất cả kết quả',
      copied: 'Đã sao chép',
      noCards: 'Không có thẻ để kiểm tra'
    }
  },

  // Generate page
  generate: {
    title: 'Tạo thẻ tín dụng',
    description: 'Tạo thẻ tín dụng hợp lệ cho mục đích thử nghiệm',
    binLabel: 'BIN (Mã định danh ngân hàng)',
    binPlaceholder: 'Nhập 6-8 chữ số (VD: 424242)',
    quantityLabel: 'Số lượng',
    monthLabel: 'Tháng hết hạn',
    yearLabel: 'Năm hết hạn',
    generateButton: 'Tạo thẻ',
    clearButton: 'Xóa tất cả',
    copyButton: 'Sao chép tất cả',
    downloadButton: 'Tải xuống',
    randomOption: 'Ngẫu nhiên',
    stats: {
      totalGenerated: 'Tổng số đã tạo',
      brands: 'Thương hiệu',
      lastGenerated: 'Lần tạo cuối'
    },
    messages: {
      enterBin: 'Vui lòng nhập BIN hợp lệ',
      invalidBin: 'BIN phải có 6-8 chữ số',
      generationStarted: 'Bắt đầu tạo thẻ',
      cardsCopied: 'Đã sao chép thẻ',
      cardsCleared: 'Đã xóa tất cả thẻ'
    }
  },

  // API Docs page
  apiDocs: {
    title: 'Tài liệu API',
    description: 'Hướng dẫn sử dụng API kiểm tra thẻ tín dụng',
    authentication: 'Xác thực',
    endpoints: 'Endpoints',
    examples: 'Ví dụ',
    response: 'Phản hồi'
  },

  // Buy Credits page
  buyCredits: {
    title: 'Mua tín dụng',
    description: 'Nạp tín dụng để sử dụng dịch vụ kiểm tra thẻ',
    currentBalance: 'Số dư hiện tại',
    selectPackage: 'Chọn gói',
    buyNow: 'Mua ngay'
  },

  // FAQ page
  faq: {
    title: 'Câu hỏi thường gặp',
    description: 'Tìm câu trả lời cho các câu hỏi phổ biến',
    searchPlaceholder: 'Tìm kiếm câu hỏi...'
  },

  // Terms page
  terms: {
    title: 'Điều khoản dịch vụ',
    description: 'Điều khoản và điều kiện sử dụng dịch vụ',
    lastUpdated: 'Cập nhật lần cuối',
    acceptance: 'Chấp nhận điều khoản',
    usage: 'Điều khoản sử dụng',
    privacy: 'Chính sách bảo mật'
  },

  // Settings page
  settings: {
    title: 'Cài đặt tài khoản',
    description: 'Quản lý thông tin tài khoản và cài đặt bảo mật',

    // Profile section
    profile: {
      title: 'Thông tin cá nhân',
      description: 'Cập nhật thông tin hồ sơ của bạn',
      username: 'Tên người dùng',
      email: 'Email',
      bio: 'Tiểu sử',
      bioPlaceholder: 'Viết một chút về bản thân...',
      avatar: 'Ảnh đại diện',
      uploadAvatar: 'Tải lên ảnh đại diện',
      changeAvatar: 'Thay đổi ảnh đại diện',
      removeAvatar: 'Xóa ảnh đại diện'
    },

    // Security section
    security: {
      title: 'Bảo mật',
      description: 'Quản lý mật khẩu và cài đặt bảo mật',
      currentPassword: 'Mật khẩu hiện tại',
      newPassword: 'Mật khẩu mới',
      confirmPassword: 'Xác nhận mật khẩu mới',
      changePassword: 'Đổi mật khẩu',
      passwordRequirements: 'Mật khẩu phải có ít nhất 8 ký tự'
    },

    // Actions
    actions: {
      save: 'Lưu thay đổi',
      cancel: 'Hủy',
      saving: 'Đang lưu...',
      saved: 'Đã lưu'
    },

    // Messages
    messages: {
      profileUpdated: 'Cập nhật hồ sơ thành công',
      profileUpdateError: 'Lỗi khi cập nhật hồ sơ',
      passwordChanged: 'Đổi mật khẩu thành công',
      passwordChangeError: 'Lỗi khi đổi mật khẩu',
      passwordMismatch: 'Mật khẩu xác nhận không khớp',
      currentPasswordRequired: 'Vui lòng nhập mật khẩu hiện tại',
      newPasswordRequired: 'Vui lòng nhập mật khẩu mới',
      avatarUploaded: 'Tải lên ảnh đại diện thành công',
      avatarUploadError: 'Lỗi khi tải lên ảnh đại diện',
      fileTooLarge: 'File quá lớn. Vui lòng chọn file nhỏ hơn 5MB',
      invalidFileType: 'Định dạng file không hợp lệ. Chỉ chấp nhận JPG, PNG, GIF'
    }
  }
};
