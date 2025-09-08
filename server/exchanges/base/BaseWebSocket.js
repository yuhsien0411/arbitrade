/**
 * WebSocket 基類 - 定義統一的 WebSocket 接口
 */
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class BaseWebSocket extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.wsClient = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000;
    this.subscriptions = new Set();
  }

  /**
   * 連接 WebSocket
   * 子類必須實現此方法
   * @returns {Promise<boolean>} 連接是否成功
   */
  async connect() {
    throw new Error('connect() method must be implemented by subclass');
  }

  /**
   * 斷開 WebSocket 連接
   * 子類必須實現此方法
   */
  async disconnect() {
    throw new Error('disconnect() method must be implemented by subclass');
  }

  /**
   * 訂閱數據流
   * 子類必須實現此方法
   * @param {string} topic - 訂閱主題
   * @param {Object} params - 訂閱參數
   */
  async subscribe(topic, params = {}) {
    throw new Error('subscribe() method must be implemented by subclass');
  }

  /**
   * 取消訂閱
   * 子類必須實現此方法
   * @param {string} topic - 訂閱主題
   */
  async unsubscribe(topic) {
    throw new Error('unsubscribe() method must be implemented by subclass');
  }

  /**
   * 處理 WebSocket 消息
   * 子類必須實現此方法
   * @param {Object} data - 接收到的數據
   */
  handleMessage(data) {
    throw new Error('handleMessage() method must be implemented by subclass');
  }

  /**
   * 檢查連接狀態
   * @returns {boolean} 是否已連接
   */
  isWSConnected() {
    return this.isConnected;
  }

  /**
   * 獲取訂閱列表
   * @returns {Array} 訂閱列表
   */
  getSubscriptions() {
    return Array.from(this.subscriptions);
  }

  /**
   * 重連機制
   */
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('WebSocket 重連次數已達上限，停止重連');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`WebSocket 重連中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        this.reconnectAttempts = 0;
        logger.info('WebSocket 重連成功');
      } catch (error) {
        logger.error('WebSocket 重連失敗:', error);
        await this.reconnect();
      }
    }, this.reconnectInterval);
  }
}

module.exports = BaseWebSocket;
