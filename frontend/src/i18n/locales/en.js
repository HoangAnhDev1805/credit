export default {
  // Common
  common: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    fullName: 'Full Name',
    submit: 'Submit',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    search: 'Search',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Information',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    home: 'Home',
    dashboard: 'Dashboard',
    profile: 'Profile',
    settings: 'Settings',
    language: 'Language',
    welcome: 'Welcome',
    getStarted: 'Get Started'
  },

  // Navigation
  nav: {
    home: 'Home',
    about: 'About',
    contact: 'Contact',
    login: 'Login',
    register: 'Register',
    dashboard: 'Dashboard',
    profile: 'Profile',
    logout: 'Logout'
  },

  // Auth
  auth: {
    login: 'Login',
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
    invalidCredentials: 'Invalid email or password',
    tooManyAttempts: 'Too many authentication attempts, please try again later',

    register: 'Register',
    registerTitle: 'Create Account',
    registerSubtitle: 'Create a new account to get started',
    fullName: 'Full Name',
    email: 'Email',
    confirmPassword: 'Confirm Password',
    registerButton: 'Create Account',
    haveAccount: 'Already have an account?',
    loginNow: 'Login now',

    // Validation messages
    validation: {
      emailRequired: 'Email is required',
      emailInvalid: 'Please enter a valid email',
      passwordRequired: 'Password is required',
      passwordMinLength: 'Password must be at least 6 characters',
      passwordsNotMatch: 'Passwords do not match',
      fullNameRequired: 'Full name is required',
      fullNameMinLength: 'Full name must be at least 2 characters'
    }
  },

  // Dashboard
  dashboard: {
    title: 'Dashboard',
    welcome: 'Welcome back, {{name}}!',
    overview: 'Overview',
    recentActivity: 'Recent Activity',
    quickActions: 'Quick Actions',
    statistics: 'Statistics',
    systemStatus: 'System Status',

    // Stats
    stats: {
      totalChecked: 'Total Checked',
      successRate: 'Success Rate',
      avgResponseTime: 'Avg Response Time',
      activeUsers: 'Active Users',
      todayChecked: 'Today Checked'
    },

    // Navigation items
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
        buyCredits: 'Buy Credits',
        apiDocs: 'API Documentation',
        faq: 'FAQ',
        terms: 'Terms of Service',
        telegramSupport: 'Telegram Support'
      }
    }
  },

  // Profile
  profile: {
    title: 'Profile',
    personalInfo: 'Personal Information',
    updateProfile: 'Update Profile',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    updateSuccess: 'Profile updated successfully',
    updateError: 'Failed to update profile'
  },

  // Errors
  errors: {
    networkError: 'Network error. Please check your connection.',
    serverError: 'Server error. Please try again later.',
    unauthorized: 'You are not authorized to access this resource.',
    forbidden: 'Access denied.',
    notFound: 'The requested resource was not found.',
    validationError: 'Please check your input and try again.',
    unknownError: 'An unknown error occurred.'
  },

  // Success messages
  success: {
    loginSuccess: 'Login successful',
    registerSuccess: 'Account created successfully',
    profileUpdated: 'Profile updated successfully',
    passwordChanged: 'Password changed successfully'
  },

  // Home page
  home: {
    title: 'Credit Card Checker',
    subtitle: 'Professional credit card checking system',
    features: {
      cardCheck: {
        title: 'Check Credit Card',
        description: 'Check credit card validity and status quickly and accurately'
      }
    }
  },

  // Checker page
  checker: {
    title: 'Credit Card Checker',
    description: 'Check credit card validity and status',
    inputPlaceholder: 'Enter credit cards in format:\nccnum|mm|yy|ccv\nccnum|mm|yyyy|ccv\n\nExample:\n4532123456789012|12|25|123\n5555444433332222|01|2026|456',
    formatInfo: 'Supported formats: ccnum|mm|yy|ccv or ccnum|mm|yyyy|ccv',
    startCheck: 'Start Check',
    stopCheck: 'Stop Check',
    clearAll: 'Clear All',
    copyResults: 'Copy Results',
    downloadResults: 'Download Results',
    filterAll: 'All',
    filterLive: 'Live',
    filterDead: 'Dead',
    filterError: 'Error',
    filterUnknown: 'Unknown',
    noData: 'No data',
    info: {
      title: 'Information',
      balance: 'Balance',
      pricePerCard: 'Price per card',
      estimatedCost: 'Estimated cost'
    },
    stats: {
      total: 'Total',
      live: 'Live',
      dead: 'Dead',
      error: 'Error',
      unknown: 'Unknown',
      progress: 'Progress',
      speed: 'Speed',
      liveRate: 'Live Rate',
      successRate: 'Success Rate',
      cards: 'cards',
      lines: 'lines'
    },
    messages: {
      enterCards: 'Please enter credit cards to check',
      invalidFormat: 'Invalid card format',
      checkingStarted: 'Started checking cards',
      checkingStopped: 'Stopped checking',
      resultsCopied: 'Results copied to clipboard',
      resultsCleared: 'All results cleared',
      copied: 'Copied',
      noCards: 'No cards to check'
    }
  },

  // Generate page
  generate: {
    title: 'Credit Card Generator',
    description: 'Generate valid credit cards for testing purposes',
    binLabel: 'BIN (Bank Identification Number)',
    binPlaceholder: 'Enter 6-8 digits (e.g., 424242)',
    quantityLabel: 'Quantity',
    monthLabel: 'Expiry Month',
    yearLabel: 'Expiry Year',
    generateButton: 'Generate Cards',
    clearButton: 'Clear All',
    copyButton: 'Copy All',
    downloadButton: 'Download',
    randomOption: 'Random',
    stats: {
      totalGenerated: 'Total Generated',
      brands: 'Brands',
      lastGenerated: 'Last Generated'
    },
    messages: {
      enterBin: 'Please enter a valid BIN',
      invalidBin: 'BIN must be 6-8 digits',
      generationStarted: 'Started generating cards',
      cardsCopied: 'Cards copied to clipboard',
      cardsCleared: 'All cards cleared'
    }
  },

  // API Docs page
  apiDocs: {
    title: 'API Documentation',
    description: 'Guide to using the credit card checking API',
    authentication: 'Authentication',
    endpoints: 'Endpoints',
    examples: 'Examples',
    response: 'Response'
  },

  // Buy Credits page
  buyCredits: {
    title: 'Buy Credits',
    description: 'Purchase credits to use the card checking service',
    currentBalance: 'Current Balance',
    selectPackage: 'Select Package',
    buyNow: 'Buy Now'
  },

  // FAQ page
  faq: {
    title: 'Frequently Asked Questions',
    description: 'Find answers to common questions',
    searchPlaceholder: 'Search questions...'
  },

  // Terms page
  terms: {
    title: 'Terms of Service',
    description: 'Terms and conditions for using our service',
    lastUpdated: 'Last Updated',
    acceptance: 'Acceptance of Terms',
    usage: 'Terms of Use',
    privacy: 'Privacy Policy'
  },

  // Settings page
  settings: {
    title: 'Account Settings',
    description: 'Manage your account information and security settings',

    // Profile section
    profile: {
      title: 'Personal Information',
      description: 'Update your profile information',
      username: 'Username',
      email: 'Email',
      bio: 'Bio',
      bioPlaceholder: 'Write a little about yourself...',
      avatar: 'Avatar',
      uploadAvatar: 'Upload Avatar',
      changeAvatar: 'Change Avatar',
      removeAvatar: 'Remove Avatar'
    },

    // Security section
    security: {
      title: 'Security',
      description: 'Manage your password and security settings',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm New Password',
      changePassword: 'Change Password',
      passwordRequirements: 'Password must be at least 8 characters long'
    },

    // Actions
    actions: {
      save: 'Save Changes',
      cancel: 'Cancel',
      saving: 'Saving...',
      saved: 'Saved'
    },

    // Messages
    messages: {
      profileUpdated: 'Profile updated successfully',
      profileUpdateError: 'Error updating profile',
      passwordChanged: 'Password changed successfully',
      passwordChangeError: 'Error changing password',
      passwordMismatch: 'Passwords do not match',
      currentPasswordRequired: 'Please enter your current password',
      newPasswordRequired: 'Please enter a new password',
      avatarUploaded: 'Avatar uploaded successfully',
      avatarUploadError: 'Error uploading avatar',
      fileTooLarge: 'File too large. Please select a file smaller than 5MB',
      invalidFileType: 'Invalid file type. Only JPG, PNG, GIF are allowed'
    }
  }


  // Crypto Payment page
  cryptoPayment: {
    title: 'Crypto Payment',
    subtitle: 'Top up your account using cryptocurrency.',
    payTitle: 'Complete Your Payment',
    payDescription: 'Please send the exact amount to the address below to receive your {credits} credits.',
    paymentInfo: 'Payment Information',
    sendTo: 'Send {label} to the address below',
    status: 'Status',
    statusPaid: 'Paid',
    statusPending: 'Pending',
    timeLeft: 'Time Left',
    receiveAddress: '{coin} Receive Address',
    amountUSD: 'Amount (USD)',
    creditsReceive: 'Credits to Receive',
    minimumAmount: 'Minimum amount:',
    newPayment: 'Create a New Payment',
    qrCode: 'QR Code',
    qrDesc: 'Scan the QR code with your wallet app.',
    scanWithWallet: 'Scan with your mobile wallet',
    orderId: 'Order ID:',
    choosePackage: 'Choose a Credit Package',
    choosePackageDesc: 'Select one of our popular packages or enter a custom amount.',
    popular: 'Popular',
    savings: 'Save {percent}',
    customAmount: 'Enter a custom amount',
    customAmountPlaceholder: 'Enter amount in USD',
    willReceive: 'You will receive ~{credits} credits',
    chooseCrypto: 'Choose Cryptocurrency',
    summary: 'Order Summary',
    amount: 'Amount',
    method: 'Method',
    total: 'Total',
    creating: 'Creating...',
    createAddress: 'Create payment address',
    currentBalance: 'Your Current Balance',
    balanceNotice: 'Your new balance will be updated after payment confirmation.',
    estimatedCryptoAmount: 'Estimated crypto to pay (based on exchange rate)',
    toasts: {
      successTitle: 'Payment Received',
      successDesc: 'Your payment has been confirmed and credits added to your account.',
      errorTitle: 'Error',
      minAmount: 'Minimum deposit amount is $1.',
      createdTitle: 'Payment Address Created',
      createdDesc: 'Please send the funds to the generated address.',
      createError: 'Failed to create payment address. Please try again.',
      copiedTitle: 'Copied',
      copiedDesc: 'The address has been copied to your clipboard.',
      copyError: 'Failed to copy address.'
    }
  }
};
