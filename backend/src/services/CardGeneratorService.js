const logger = require('../config/logger');

class CardGeneratorService {
  constructor() {
    // BIN ranges for different card types
    this.binRanges = {
      visa: [
        { start: '400000', end: '499999' },
        { start: '400000', end: '499999' }
      ],
      mastercard: [
        { start: '510000', end: '559999' },
        { start: '222100', end: '272099' }
      ],
      amex: [
        { start: '340000', end: '349999' },
        { start: '370000', end: '379999' }
      ],
      discover: [
        { start: '601100', end: '601199' },
        { start: '644000', end: '649999' },
        { start: '650000', end: '659999' }
      ]
    };

    // Common test BINs (for development/testing)
    this.testBins = [
      '457173', '411111', '424242', '400000', '555555',
      '378282', '371449', '378734', '341111', '601111'
    ];
  }

  /**
   * Generate credit card numbers
   * @param {Object} options - Generation options
   * @returns {Array} Array of generated cards
   */
  generateCards(options = {}) {
    const {
      bin = '457173',
      quantity = 10,
      month = 'random',
      year = 'random',
      cvv = 'random',
      format = 'XXXXXXXXXXXXXXXX|MM|YY|CVV',
      validCardsOnly = true
    } = options;

    try {
      const cards = [];
      const maxAttempts = quantity * 10; // Prevent infinite loops
      let attempts = 0;

      while (cards.length < quantity && attempts < maxAttempts) {
        attempts++;

        const cardNumber = this.generateCardNumber(bin, validCardsOnly);
        const expMonth = this.generateMonth(month);
        const expYear = this.generateYear(year);
        const cardCvv = this.generateCVV(cvv, cardNumber);

        if (cardNumber) {
          const card = this.formatCard({
            cardNumber,
            month: expMonth,
            year: expYear,
            cvv: cardCvv,
            format
          });

          cards.push(card);
        }
      }

      logger.info(`Generated ${cards.length} cards with BIN ${bin}`);
      return cards;
    } catch (error) {
      logger.error('Error generating cards:', error);
      throw new Error('Failed to generate cards');
    }
  }

  /**
   * Generate a single card number
   * @param {string} bin - Bank Identification Number (6 digits)
   * @param {boolean} validCardsOnly - Whether to use Luhn algorithm
   * @returns {string} Generated card number
   */
  generateCardNumber(bin, validCardsOnly = true) {
    try {
      // Validate BIN
      if (!/^\d{6}$/.test(bin)) {
        throw new Error('BIN must be exactly 6 digits');
      }

      // Determine card length based on BIN
      const cardLength = this.getCardLength(bin);
      
      // Generate remaining digits (excluding check digit)
      const remainingLength = cardLength - bin.length - 1;
      let cardNumber = bin;

      // Add random digits
      for (let i = 0; i < remainingLength; i++) {
        cardNumber += Math.floor(Math.random() * 10);
      }

      // Add check digit if validCardsOnly is true
      if (validCardsOnly) {
        const checkDigit = this.calculateLuhnCheckDigit(cardNumber);
        cardNumber += checkDigit;
      } else {
        cardNumber += Math.floor(Math.random() * 10);
      }

      return cardNumber;
    } catch (error) {
      logger.error('Error generating card number:', error);
      return null;
    }
  }

  /**
   * Generate expiry month
   * @param {string} month - Month specification ('random', 'MM', or specific month)
   * @returns {string} Generated month (01-12)
   */
  generateMonth(month) {
    if (month === 'random') {
      return String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    }

    if (/^(0[1-9]|1[0-2])$/.test(month)) {
      return month;
    }

    // Default to random if invalid
    return String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  }

  /**
   * Generate expiry year
   * @param {string} year - Year specification ('random', 'YY', 'YYYY', or specific year)
   * @returns {string} Generated year
   */
  generateYear(year) {
    if (year === 'random') {
      const currentYear = new Date().getFullYear();
      const randomYear = currentYear + Math.floor(Math.random() * 10); // Next 10 years
      return String(randomYear).slice(-2); // Return last 2 digits
    }

    if (/^\d{2}$/.test(year)) {
      return year;
    }

    if (/^\d{4}$/.test(year)) {
      return year.slice(-2);
    }

    // Default to random if invalid
    const currentYear = new Date().getFullYear();
    const randomYear = currentYear + Math.floor(Math.random() * 10);
    return String(randomYear).slice(-2);
  }

  /**
   * Generate CVV
   * @param {string} cvv - CVV specification ('random', 'XXX', or specific CVV)
   * @param {string} cardNumber - Card number to determine CVV length
   * @returns {string} Generated CVV
   */
  generateCVV(cvv, cardNumber) {
    const cvvLength = this.getCVVLength(cardNumber);

    if (cvv === 'random') {
      let randomCvv = '';
      for (let i = 0; i < cvvLength; i++) {
        randomCvv += Math.floor(Math.random() * 10);
      }
      return randomCvv;
    }

    if (new RegExp(`^\\d{${cvvLength}}$`).test(cvv)) {
      return cvv;
    }

    // Default to random if invalid
    let randomCvv = '';
    for (let i = 0; i < cvvLength; i++) {
      randomCvv += Math.floor(Math.random() * 10);
    }
    return randomCvv;
  }

  /**
   * Format card according to specified format
   * @param {Object} cardData - Card data
   * @returns {Object} Formatted card
   */
  formatCard({ cardNumber, month, year, cvv, format }) {
    const formattedCard = format
      .replace(/X+/g, cardNumber)
      .replace(/MM/g, month)
      .replace(/YY/g, year)
      .replace(/YYYY/g, '20' + year)
      .replace(/CVV/g, cvv);

    return {
      cardNumber,
      expiryMonth: month,
      expiryYear: year,
      cvv,
      fullCard: formattedCard,
      brand: this.detectCardBrand(cardNumber),
      bin: cardNumber.substring(0, 6)
    };
  }

  /**
   * Calculate Luhn check digit
   * @param {string} cardNumber - Card number without check digit
   * @returns {string} Check digit
   */
  calculateLuhnCheckDigit(cardNumber) {
    let sum = 0;
    let isEven = true;

    // Process digits from right to left
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i));

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return String(checkDigit);
  }

  /**
   * Validate card number using Luhn algorithm
   * @param {string} cardNumber - Card number to validate
   * @returns {boolean} Whether card number is valid
   */
  validateCardNumber(cardNumber) {
    if (!/^\d+$/.test(cardNumber)) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i));

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Detect card brand from card number
   * @param {string} cardNumber - Card number
   * @returns {string} Card brand
   */
  detectCardBrand(cardNumber) {
    const firstDigit = cardNumber.charAt(0);
    const firstTwoDigits = cardNumber.substring(0, 2);
    const firstThreeDigits = cardNumber.substring(0, 3);
    const firstFourDigits = cardNumber.substring(0, 4);

    // Visa
    if (firstDigit === '4') {
      return 'visa';
    }

    // Mastercard
    if (firstTwoDigits >= '51' && firstTwoDigits <= '55') {
      return 'mastercard';
    }
    if (firstFourDigits >= '2221' && firstFourDigits <= '2720') {
      return 'mastercard';
    }

    // American Express
    if (firstTwoDigits === '34' || firstTwoDigits === '37') {
      return 'amex';
    }

    // Discover
    if (firstFourDigits === '6011' || firstTwoDigits === '65' ||
        (firstThreeDigits >= '644' && firstThreeDigits <= '649')) {
      return 'discover';
    }

    // JCB
    if (firstFourDigits >= '3528' && firstFourDigits <= '3589') {
      return 'jcb';
    }

    // Diners Club
    if ((firstTwoDigits >= '30' && firstTwoDigits <= '38') ||
        firstTwoDigits === '36' || firstTwoDigits === '38') {
      return 'diners';
    }

    return 'unknown';
  }

  /**
   * Get card length based on BIN
   * @param {string} bin - Bank Identification Number
   * @returns {number} Card length
   */
  getCardLength(bin) {
    const brand = this.detectCardBrand(bin + '0000000000');
    
    switch (brand) {
      case 'amex':
        return 15;
      case 'diners':
        return 14;
      default:
        return 16;
    }
  }

  /**
   * Get CVV length based on card number
   * @param {string} cardNumber - Card number
   * @returns {number} CVV length
   */
  getCVVLength(cardNumber) {
    const brand = this.detectCardBrand(cardNumber);
    return brand === 'amex' ? 4 : 3;
  }

  /**
   * Get random BIN for specified brand
   * @param {string} brand - Card brand
   * @returns {string} Random BIN
   */
  getRandomBIN(brand = 'visa') {
    const ranges = this.binRanges[brand];
    if (!ranges || ranges.length === 0) {
      return this.testBins[Math.floor(Math.random() * this.testBins.length)];
    }

    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const start = parseInt(range.start);
    const end = parseInt(range.end);
    const randomBin = Math.floor(Math.random() * (end - start + 1)) + start;
    
    return String(randomBin).padStart(6, '0');
  }

  /**
   * Get supported card brands
   * @returns {Array} Array of supported brands
   */
  getSupportedBrands() {
    return Object.keys(this.binRanges);
  }

  /**
   * Get test BINs
   * @returns {Array} Array of test BINs
   */
  getTestBINs() {
    return [...this.testBins];
  }
}

module.exports = new CardGeneratorService();
