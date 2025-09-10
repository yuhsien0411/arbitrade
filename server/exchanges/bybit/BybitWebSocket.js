const BaseWebSocket = require('../base/BaseWebSocket');
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class BybitWebSocket extends BaseWebSocket {
  constructor(config) {
    super(config);
    this.emitter = new EventEmitter();
  }

  async connect() {
    try {
      // 模擬連線成功
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('[BybitWebSocket] 已連線');
      return true;
    } catch (error) {
      this.isConnected = false;
      logger.error('[BybitWebSocket] 連線失敗:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      this.isConnected = false;
      logger.info('[BybitWebSocket] 已斷線');
    } catch (error) {
      logger.error('[BybitWebSocket] 斷線失敗:', error);
    }
  }

  async subscribe(topic, params = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    this.subscriptions.add(topic);
    logger.info(`[BybitWebSocket] 訂閱: ${topic}`);
    return true;
  }

  async unsubscribe(topic) {
    this.subscriptions.delete(topic);
    logger.info(`[BybitWebSocket] 取消訂閱: ${topic}`);
    return true;
  }

  handleMessage(data) {
    try {
      this.emitter.emit('message', data);
    } catch (error) {
      logger.error('[BybitWebSocket] 處理訊息失敗:', error);
    }
  }

  onMessage(listener) {
    this.emitter.on('message', listener);
  }
}

module.exports = BybitWebSocket;

