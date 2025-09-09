// Jest 設置文件
const logger = require('./utils/logger');

// 模擬 logger 以避免測試中的日誌輸出
jest.mock('./utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// 設置測試環境變量
process.env.NODE_ENV = 'test';

// 全局測試超時
jest.setTimeout(10000);

// 清理所有 mock
afterEach(() => {
  jest.clearAllMocks();
});
