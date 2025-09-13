/**
 * 雙腿套利頁面
 * 參考Taoli Tools設計，實現專業的雙腿下單功能
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Row, Col, Card, Form, Select, InputNumber, Button, Table, Space, 
  Typography, Tag, Switch, Modal, Divider, Alert, Tooltip, Input, App as AntdApp
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined,
  SettingOutlined, ReloadOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { apiService, MonitoringPairConfig } from '../services/api';
import { addMonitoringPair, removeMonitoringPair, updateMonitoringPair, updateOpportunity } from '../store/slices/arbitrageSlice';
import { updateExchanges } from '../store/slices/systemSlice';
import { formatAmountWithCurrency } from '../utils/formatters';
import exchangeApi from '../services/exchangeApi';
import logger from '../utils/logger';

// 擴展 ArbitragePair 介面以支援新參數
interface ArbitragePairExtended {
  id: string;
  leg1: {
    exchange: string;
    symbol: string;
    type: string;
    side?: string;
  };
  leg2: {
    exchange: string;
    symbol: string;
    type: string;
    side?: string;
  };
  threshold: number;
  amount: number;
  enabled: boolean;
  createdAt: number;
  lastTriggered: number | null;
  totalTriggers: number;
  qty?: number;
  totalAmount?: number;
  consumedAmount?: number;
  [key: string]: any;
}

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const ArbitragePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = AntdApp.useApp();
  const { exchanges, isConnected } = useSelector((state: RootState) => state.system);
  const { monitoringPairs: rawMonitoringPairs, currentOpportunities } = useSelector((state: RootState) => state.arbitrage);
  // 將 monitoringPairs 轉換為擴展類型以支援新參數
  const monitoringPairs = rawMonitoringPairs as ArbitragePairExtended[];
  // 避免 effect 依賴變更導致反覆重建 interval：用 ref 保存最新列表
  const monitoringPairsRef = useRef<ArbitragePairExtended[]>(monitoringPairs);
  useEffect(() => { monitoringPairsRef.current = monitoringPairs; }, [monitoringPairs]);

  // 最近一次已渲染的價格快照，用於跳過無變化的更新，降低閃爍
  const lastSnapshotRef = useRef<Record<string, { l1b: number; l1a: number; l2b: number; l2a: number }>>({});
  // 更新節流：對齊 bybit 的穩定感，每個 pair 最快 1s 更新一次
  const lastUpdateAtRef = useRef<Record<string, number>>({});
  // 上一次有效價，用於 UI 顯示回退（避免顯示 '-')
  const lastGoodPriceRef = useRef<Record<string, { l1b: number; l1a: number; l2b: number; l2a: number }>>({});
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPair, setEditingPair] = useState<any>(null);

  // 可用的交易所和交易對
  const defaultExchanges = [
    {
      key: 'bybit',
      name: 'Bybit',
      supportCustomSymbol: true,
      description: '支援用戶自行輸入任何可用的交易對',
      status: 'active',
      implemented: true,
      connected: true
    },
    {
      key: 'binance',
      name: 'Binance',
      supportCustomSymbol: true,
      description: '暫不啟用（保留）',
      status: 'planned',
      implemented: false,
      connected: false
    }
  ];

  // 優先使用系統中的交易所，如果沒有則使用預設
  const availableExchanges = Object.keys(exchanges).length > 0
    ? Object.entries(exchanges)
        .map(([key, exchange]) => ({ 
          key, 
          name: exchange.name, 
          supportCustomSymbol: true,
          description: exchange.message || '支援自定義交易對',
          connected: exchange.connected,
          status: exchange.status ?? (key === 'bybit' ? 'active' : 'planned'),
          implemented: exchange.implemented ?? (key === 'bybit'),
          features: exchange.features,
          priority: exchange.priority
        }))
    : defaultExchanges;

  const loadMonitoringPairs = useCallback(async () => {
    try {
      const response = await apiService.getMonitoringPairs();
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((pair: any) => {
          dispatch(addMonitoringPair(pair));
        });
      }
    } catch (error) {
      logger.error('載入監控交易對失敗', error, 'ArbitragePage');
    }
  }, [dispatch]);

  // 載入監控交易對和價格數據
  useEffect(() => {
    loadMonitoringPairs();

    // 加載交易所狀態（對齊 pmC.md）
    (async () => {
      try {
        const res = await apiService.getExchangeStatus();
        if (res?.data) {
          dispatch(updateExchanges(res.data as any));
        }
      } catch (e) {
        // 忽略錯誤，保留預設 exchanges
      }
    })();
    
    // 統一透過後端價格代理獲取訂單簿，再轉成簡化 ticker 結構
    const fetchTickerData = async () => {
      try {
        const pairs = monitoringPairsRef.current || [];
        logger.info('開始獲取 ticker 數據', { monitoringPairsCount: pairs.length }, 'ArbitragePage');
        // 如果有監控交易對，直接從交易所獲取數據
        if (pairs.length > 0) {
          for (const pair of pairs) {
            try {
              // 基本資料校驗（避免 undefined 造成報錯）
              if (!pair || !pair.leg1 || !pair.leg2 || !pair.leg1.exchange || !pair.leg2.exchange || !pair.leg1.symbol || !pair.leg2.symbol) {
                logger.warn('監控交易對資料不完整，已跳過', pair as any, 'ArbitragePage');
                continue;
              }

              // 跳過被暫停的交易所（保留但不抓價）
              const disabledExchanges = new Set(['binance', 'okx', 'bitget']);
              if (disabledExchanges.has(pair.leg1.exchange) || disabledExchanges.has(pair.leg2.exchange)) {
                continue;
              }

              logger.info(`獲取交易對 ${pair.id} 的價格數據`, {
                leg1: `${pair.leg1.exchange}:${pair.leg1.symbol}`,
                leg2: `${pair.leg2.exchange}:${pair.leg2.symbol}`
              }, 'ArbitragePage');
              
              const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000';
              const legToCategory = (leg: any) => {
                const t = (leg?.type || '').toString().toLowerCase();
                return t === 'future' || t === 'futures' || t === 'linear' || t === 'inverse' ? 'futures' : 'spot';
              };
              const buildTickerUrl = (leg: any) => `${apiBase}/api/ticker/${leg.exchange}/${leg.symbol}?category=${legToCategory(leg)}`;
              const buildOrderbookUrl = (leg: any) => `${apiBase}/api/prices/${leg.exchange}/${leg.symbol}`;

              const fetchTickerForLeg = async (leg: any) => {
                // 先用公開 ticker；若無效或為 0，改用訂單簿 top1 作為回退
                try {
                  const res = await fetch(buildTickerUrl(leg));
                  const data = await res.json();
                  if (data?.success && data?.data) {
                    const tk = data.data;
                    const bid = Number(tk?.bid1?.price || 0);
                    const ask = Number(tk?.ask1?.price || 0);
                    if (bid > 0 || ask > 0) {
                      return { symbol: leg.symbol, bidPrice: bid, askPrice: ask, lastPrice: 0, volume: 0, timestamp: tk?.ts || Date.now() };
                    }
                  }
                } catch {}
                // 回退到訂單簿
                try {
                  const res2 = await fetch(buildOrderbookUrl(leg));
                  const json2 = await res2.json();
                  const bid1 = json2?.data?.bids?.[0]?.[0];
                  const ask1 = json2?.data?.asks?.[0]?.[0];
                  return {
                    symbol: leg.symbol,
                    bidPrice: Number(bid1 || 0),
                    askPrice: Number(ask1 || 0),
                    lastPrice: 0,
                    volume: 0,
                    timestamp: Date.now()
                  };
                } catch {
                  throw new Error('公開 ticker 與訂單簿回退皆失敗');
                }
              };

              // 並行從後端取得最優價（含回退）
              const [leg1Ticker, leg2Ticker] = await Promise.allSettled([
                fetchTickerForLeg(pair.leg1),
                fetchTickerForLeg(pair.leg2)
              ]);
              
              if (leg1Ticker.status === 'fulfilled' && leg2Ticker.status === 'fulfilled') {
                // 忽略無效數據（bid/ask 皆為 0）以避免畫面顯示 0 與閃爍
                const validLeg1 = (leg1Ticker.value.bidPrice || 0) > 0 || (leg1Ticker.value.askPrice || 0) > 0;
                const validLeg2 = (leg2Ticker.value.bidPrice || 0) > 0 || (leg2Ticker.value.askPrice || 0) > 0;
                if (!validLeg1 || !validLeg2) {
                  continue;
                }
                logger.info(`成功獲取交易對 ${pair.id} 的價格數據`, {
                  leg1: leg1Ticker.value,
                  leg2: leg2Ticker.value
                }, 'ArbitragePage');
                
                // 計算套利機會
                const opportunity = exchangeApi.calculateArbitrageOpportunity(
                  leg1Ticker.value,
                  leg2Ticker.value,
                  (pair.leg1.side as 'buy' | 'sell') || 'buy',
                  (pair.leg2.side as 'buy' | 'sell') || 'sell',
                  pair.leg1.exchange,
                  pair.leg2.exchange
                );
                
                // 若價格與上次相同就跳過，以減少重繪
                const snapKey = pair.id;
                const nextSnap = {
                  l1b: opportunity.leg1Price.bid1.price,
                  l1a: opportunity.leg1Price.ask1.price,
                  l2b: opportunity.leg2Price.bid1.price,
                  l2a: opportunity.leg2Price.ask1.price
                };
                const prevSnap = lastSnapshotRef.current[snapKey];
                if (prevSnap && prevSnap.l1b === nextSnap.l1b && prevSnap.l1a === nextSnap.l1a && prevSnap.l2b === nextSnap.l2b && prevSnap.l2a === nextSnap.l2a) {
                  continue;
                }
                lastSnapshotRef.current[snapKey] = nextSnap;

                // 每個 pair 做 1000ms 節流，令 Binance 刷新節奏與 Bybit 接近
                const nowTs = Date.now();
                if ((lastUpdateAtRef.current[snapKey] || 0) > nowTs - 1000) {
                  continue;
                }
                lastUpdateAtRef.current[snapKey] = nowTs;

                logger.info(`交易對 ${pair.id} 套利機會計算結果`, opportunity, 'ArbitragePage');

                // 使用回退：若計算結果不存在或為 0，回退到上一筆有效價
                const fallbackPrev = lastGoodPriceRef.current[snapKey];
                const safeL1b = opportunity.leg1Price.bid1.price || fallbackPrev?.l1b || 0;
                const safeL1a = opportunity.leg1Price.ask1.price || fallbackPrev?.l1a || 0;
                const safeL2b = opportunity.leg2Price.bid1.price || fallbackPrev?.l2b || 0;
                const safeL2a = opportunity.leg2Price.ask1.price || fallbackPrev?.l2a || 0;

                // 更新 Redux store
                dispatch(updateOpportunity({
                  id: pair.id,
                  pairConfig: {
                    ...pair,
                    leg1: {
                      ...pair.leg1,
                      type: pair.leg1.type as 'linear' | 'inverse' | 'spot' | 'future',
                      side: (pair.leg1.side as 'buy' | 'sell') || 'buy'
                    },
                    leg2: {
                      ...pair.leg2,
                      type: pair.leg2.type as 'linear' | 'inverse' | 'spot' | 'future',
                      side: (pair.leg2.side as 'buy' | 'sell') || 'sell'
                    }
                  },
                  leg1Price: {
                    ...opportunity.leg1Price,
                    exchange: pair.leg1.exchange,
                    bid1: { price: safeL1b, amount: 0 },
                    ask1: { price: safeL1a, amount: 0 }
                  },
                  leg2Price: {
                    ...opportunity.leg2Price,
                    exchange: pair.leg2.exchange,
                    bid1: { price: safeL2b, amount: 0 },
                    ask1: { price: safeL2a, amount: 0 }
                  },
                  spread: opportunity.spread,
                  spreadPercent: opportunity.spreadPercent,
                  threshold: pair.threshold || 0.1,
                  shouldTrigger: opportunity.shouldTrigger,
                  timestamp: opportunity.timestamp,
                  direction: (pair.leg1.side === 'sell' && pair.leg2.side === 'buy') 
                    ? 'leg1_sell_leg2_buy' 
                    : 'leg1_buy_leg2_sell'
                }));

                // 記錄本次有效價，供下次回退使用
                lastGoodPriceRef.current[snapKey] = {
                  l1b: safeL1b,
                  l1a: safeL1a,
                  l2b: safeL2b,
                  l2a: safeL2a
                };
              }
            } catch (error) {
              logger.error(`獲取交易對 ${pair.id} 價格失敗`, error, 'ArbitragePage');
            }
          }
        } else {
          // 沒有監控交易對時，使用模擬數據
          const mockOpportunities = [
            {
              id: 'mock_pair_1',
              leg1Price: {
                symbol: 'BTCUSDT',
                exchange: 'bybit',
                bid1: { price: 50000 + Math.random() * 1000 },
                ask1: { price: 50000 + Math.random() * 1000 + 10 }
              },
              leg2Price: {
                symbol: 'BTCUSDT',
                exchange: 'binance',
                bid1: { price: 50000 + Math.random() * 1000 },
                ask1: { price: 50000 + Math.random() * 1000 + 10 }
              },
              spread: Math.random() * 0.1,
              spreadPercent: Math.random() * 0.1,
              shouldTrigger: Math.random() > 0.7,
              timestamp: Date.now()
            }
          ];
          
          mockOpportunities.forEach((opportunity: any) => {
            dispatch(updateOpportunity(opportunity));
          });
        }
      } catch (error) {
        logger.error('獲取實時價格失敗', error, 'ArbitragePage');
      }
    };

    // 先立即抓一次，避免初始畫面無數據
    fetchTickerData();

    // 定期獲取價格數據（調整為每 5 秒）
    const priceInterval = setInterval(fetchTickerData, 5000);

    // 清理定時器
    return () => {
      clearInterval(priceInterval);
    };
  }, [dispatch, loadMonitoringPairs, monitoringPairs]);

  // 添加/更新監控交易對
  const handleSubmit = async (values: any) => {
    try {
      logger.info('開始提交監控交易對表單', values, 'ArbitragePage');
      setLoading(true);
      
      // 生成唯一 ID（如果沒有編輯中的交易對）
      const pairId = editingPair?.id || `pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const config: MonitoringPairConfig = {
        id: pairId,
        leg1: {
          exchange: values.leg1_exchange || 'bybit',
          symbol: values.leg1_symbol || 'BTCUSDT',
          type: values.leg1_type || 'spot',
          side: values.leg1_side || 'buy',
        },
        leg2: {
          exchange: values.leg2_exchange || 'binance',
          symbol: values.leg2_symbol || 'BTCUSDT',
          type: values.leg2_type || 'spot',
          side: values.leg2_side || 'sell',
        },
        threshold: values.threshold || 0.1,
        amount: values.amount || 100,
        enabled: values.enabled ?? true,
        executionMode: values.executionMode || 'threshold',
        qty: values.qty || 0.01,
        totalAmount: values.totalAmount || 1000,
        consumedAmount: 0
      };

      logger.info('構建的監控配置', config, 'ArbitragePage');

      let response;
      if (editingPair) {
        logger.info('更新現有監控交易對', editingPair.id, 'ArbitragePage');
        // 更新時不傳遞 ID，只傳遞更新數據
        const updateData = { ...config };
        delete updateData.id; // 移除 ID，避免傳遞到更新請求中
        response = await apiService.updateMonitoringPair(editingPair.id, updateData);
        logger.info('更新響應', response, 'ArbitragePage');
      } else {
        logger.info('添加新監控交易對', null, 'ArbitragePage');
        response = await apiService.addMonitoringPair(config);
        logger.info('添加響應', response, 'ArbitragePage');
      }

      if (response.data) {
        logger.info('操作成功，更新 Redux 狀態', response.data, 'ArbitragePage');
        dispatch(addMonitoringPair(response.data));
        message.success(editingPair ? '更新成功' : '添加成功');
        setIsModalVisible(false);
        form.resetFields();
        setEditingPair(null);
      }
    } catch (error: any) {
      logger.error('操作失敗', error, 'ArbitragePage');
      message.error(error.message || '操作失敗');
    } finally {
      setLoading(false);
    }
  };

  // 刪除監控交易對
  const handleDelete = (id: string) => {
    confirm({
      title: '確認刪除',
      content: '確定要刪除這個監控交易對嗎？',
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        try {
          await apiService.removeMonitoringPair(id);
          dispatch(removeMonitoringPair(id));
          message.success('刪除成功');
        } catch (error: any) {
          message.error(error.message || '刪除失敗');
        }
      },
    });
  };

  // 切換啟用狀態
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await apiService.updateMonitoringPair(id, { enabled });
      dispatch(updateMonitoringPair({ id, updates: { enabled } }));
      message.success(enabled ? '已啟用' : '已停用');
    } catch (error: any) {
      message.error(error.message || '操作失敗');
    }
  };

  // 手動執行套利
  const handleExecuteArbitrage = async (pairId: string) => {
    const pair = monitoringPairs.find(p => p.id === pairId);
    if (!pair) {
      message.error('找不到監控交易對配置');
      return;
    }

    // 顯示執行確認對話框
    confirm({
      title: '確認執行套利交易',
      icon: <ExclamationCircleOutlined />,
      width: 600,
      content: (
        <div>
          <Alert
            message="即將執行雙腿套利交易"
            description="請確認以下交易信息無誤後再執行"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="Leg 1" style={{ marginBottom: 8 }}>
                <p><strong>交易所:</strong> {pair.leg1.exchange}</p>
                <p><strong>交易對:</strong> {pair.leg1.symbol}</p>
                <p><strong>類型:</strong> {
                  pair.leg1.type === 'spot' ? '現貨' : 
                  pair.leg1.type === 'linear' ? '線性合約' : 
                  pair.leg1.type === 'inverse' ? '反向合約' : 
                  pair.leg1.type === 'future' ? '線性合約' : '合約'
                }</p>
                <p><strong>方向:</strong> <Tag color={pair.leg1.side === 'sell' ? 'red' : 'green'}>{pair.leg1.side === 'sell' ? '賣出' : '買入'}</Tag></p>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card size="small" title="Leg 2" style={{ marginBottom: 8 }}>
                <p><strong>交易所:</strong> {pair.leg2.exchange}</p>
                <p><strong>交易對:</strong> {pair.leg2.symbol}</p>
                <p><strong>類型:</strong> {
                  pair.leg2.type === 'spot' ? '現貨' : 
                  pair.leg2.type === 'linear' ? '線性合約' : 
                  pair.leg2.type === 'inverse' ? '反向合約' : 
                  pair.leg2.type === 'future' ? '線性合約' : '合約'
                }</p>
                <p><strong>方向:</strong> <Tag color={pair.leg2.side === 'sell' ? 'red' : 'green'}>{pair.leg2.side === 'sell' ? '賣出' : '買入'}</Tag></p>
              </Card>
            </Col>
          </Row>
          
          <Card size="small" title="交易參數" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              <Col span={8}>
                <p><strong>每筆下單量:</strong> {
                  Number(pair.qty || 0.01) % 1 === 0 
                    ? (pair.qty || 0.01).toLocaleString()
                    : (pair.qty || 0.01).toLocaleString(undefined, { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 8 
                      })
                }</p>
              </Col>
              <Col span={16}>
                <p><strong>執行模式:</strong> 
                  <Tag color={pair.executionMode === 'auto' ? 'green' : 'blue'}>
                    {pair.executionMode === 'auto' ? '自動執行' : '手動確認'}
                  </Tag>
                </p>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={8}>
                <p><strong>交易數量:</strong> {formatAmountWithCurrency(pair?.amount || 0, pair?.leg1?.symbol || pair?.leg2?.symbol || 'BTCUSDT')}</p>
              </Col>
              <Col span={8}>
                <p><strong>觸發閾值:</strong> {pair.threshold}%</p>
              </Col>
              <Col span={8}>
                <p><strong>當前狀態:</strong> 
                  <Tag color={pair.enabled ? 'green' : 'red'}>
                    {pair.enabled ? '監控中' : '已暫停'}
                  </Tag>
                </p>
              </Col>
            </Row>
          </Card>
          
          <Alert
            message="風險提醒"
            description="套利交易存在市場風險，請確保您已充分了解相關風險並具備足夠的資金餘額。"
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      okText: '確認執行',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await apiService.executeArbitrage(pairId);
          
          if (response.data && response.data.success) {
            const result = response.data;
            
            // 顯示執行結果
            Modal.success({
              title: '套利執行成功',
              width: 700,
              content: (
                <div>
                  <Alert
                    message="雙腿訂單已成功提交"
                    description={`執行時間: ${new Date(result.timestamp).toLocaleString()}`}
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <Card size="small" title="Leg 1 訂單" style={{ marginBottom: 8 }}>
                        <p><strong>交易所:</strong> {result.leg1.exchange}</p>
                        <p><strong>交易對:</strong> {result.leg1.symbol}</p>
                        <p><strong>方向:</strong> <Tag color="green">{result.leg1.side === 'buy' ? '買入' : '賣出'}</Tag></p>
                        <p><strong>數量:</strong> {result.leg1.quantity}</p>
                        <p><strong>價格:</strong> ${result.leg1.price}</p>
                        <p><strong>訂單ID:</strong> <Text code>{result.leg1.orderId}</Text></p>
                      </Card>
                    </Col>
                    
                    <Col span={12}>
                      <Card size="small" title="Leg 2 訂單" style={{ marginBottom: 8 }}>
                        <p><strong>交易所:</strong> {result.leg2.exchange}</p>
                        <p><strong>交易對:</strong> {result.leg2.symbol}</p>
                        <p><strong>方向:</strong> <Tag color="red">{result.leg2.side === 'buy' ? '買入' : '賣出'}</Tag></p>
                        <p><strong>數量:</strong> {result.leg2.quantity}</p>
                        <p><strong>價格:</strong> ${result.leg2.price}</p>
                        <p><strong>訂單ID:</strong> <Text code>{result.leg2.orderId}</Text></p>
                      </Card>
                    </Col>
                  </Row>
                  
                  <Card size="small" title="套利結果" style={{ marginTop: 8 }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <p><strong>價差:</strong> <Text type="success">{result.spread}%</Text></p>
                      </Col>
                      <Col span={8}>
                        <p><strong>預期利潤:</strong> <Text type="success">${result.profit}</Text></p>
                      </Col>
                      <Col span={8}>
                        <p><strong>執行狀態:</strong> <Tag color="green">成功</Tag></p>
                      </Col>
                    </Row>
                  </Card>
                </div>
              )
            });
            
            message.success('雙腿套利交易執行成功！');
          } else {
            message.error('套利執行失敗：' + (response.data?.error || '未知錯誤'));
          }
        } catch (error: any) {
          message.error('執行失敗: ' + (error.message || '網絡錯誤'));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 編輯監控交易對
  const handleEdit = (pair: any) => {
    setEditingPair(pair);
    form.setFieldsValue({
      leg1_exchange: pair.leg1.exchange,
      leg1_symbol: pair.leg1.symbol,
      leg1_type: pair.leg1.type,
      leg1_side: pair.leg1.side || 'buy',
      leg2_exchange: pair.leg2.exchange,
      leg2_symbol: pair.leg2.symbol,
      leg2_type: pair.leg2.type,
      leg2_side: pair.leg2.side || 'sell',
      threshold: pair.threshold,
      amount: pair.amount,
      enabled: pair.enabled,
      executionMode: pair.executionMode || 'threshold',
    });
    setIsModalVisible(true);
  };

  // 表格列定義
  const columns = [
    {
      title: 'Leg 1',
      key: 'leg1',
      render: (record: any) => {
        if (!record.leg1) {
          return <Text type="secondary">數據載入中...</Text>;
        }
        return (
        <Space direction="vertical" size="small">
            <Text strong>{record.leg1.symbol || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {exchanges[record.leg1.exchange]?.name} {
              record.leg1.type === 'spot' ? '現貨' : 
              record.leg1.type === 'linear' ? '線性合約' : 
              record.leg1.type === 'inverse' ? '反向合約' : 
              record.leg1.type === 'future' ? '線性合約' : record.leg1.type
            } · {record.leg1.side === 'sell' ? '賣出' : '買入'}
          </Text>
        </Space>
        );
      },
    },
    {
      title: 'Leg 2',
      key: 'leg2',
      render: (record: any) => {
        if (!record.leg2) {
          return <Text type="secondary">數據載入中...</Text>;
        }
        return (
        <Space direction="vertical" size="small">
            <Text strong>{record.leg2.symbol || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {exchanges[record.leg2.exchange]?.name} {
              record.leg2.type === 'spot' ? '現貨' : 
              record.leg2.type === 'linear' ? '線性合約' : 
              record.leg2.type === 'inverse' ? '反向合約' : 
              record.leg2.type === 'future' ? '線性合約' : record.leg2.type
            } · {record.leg2.side === 'sell' ? '賣出' : '買入'}
          </Text>
        </Space>
        );
      },
    },
    {
      title: '實時價格',
      key: 'realtimePrices',
      render: (record: any) => {
        const opportunity = currentOpportunities.find(o => o.id === record.id);
        if (!opportunity) {
          return <Text type="secondary">等待數據...</Text>;
        }
        
        return (
          <Space direction="vertical" size="small" style={{ fontSize: '11px', minWidth: '160px' }}>
            {/* Leg1 價格 */}
            <div style={{ 
              background: '#f0f2ff', 
              padding: '6px 8px', 
              borderRadius: '6px',
              border: '1px solid #d9d9ff'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '4px', 
                color: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{opportunity.leg1Price.symbol}</span>
                <span style={{ fontSize: '10px', color: '#666' }}>
                  {opportunity.leg1Price.exchange}
                </span>
              </div>
              {(() => { const leg1Side = (record as any)?.leg1?.side || (opportunity as any)?.pairConfig?.leg1?.side; return leg1Side ? (
                <div style={{ 
                  background: leg1Side === 'buy' ? '#fff2f0' : '#f6ffed',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  textAlign: 'center',
                  border: '1px solid ' + (leg1Side === 'buy' ? '#ffccc7' : '#b7eb8f')
                }}>
                  <div style={{ 
                    color: leg1Side === 'buy' ? '#ff4d4f' : '#52c41a',
                    fontWeight: 600
                  }}>
                    {(() => {
                      const price = leg1Side === 'buy' 
                        ? opportunity.leg1Price.ask1?.price 
                        : opportunity.leg1Price.bid1?.price;
                      return typeof price === 'number' ? price.toFixed(4) : '-';
                    })()}
                  </div>
                  <div style={{ fontSize: '9px', color: '#999' }}>
                    {leg1Side === 'buy' ? '按賣一成交' : '按買一成交'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ 
                    background: '#f6ffed', 
                    padding: '2px 4px', 
                    borderRadius: '3px',
                    flex: 1,
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#52c41a', fontWeight: '500' }}>
                      {opportunity.leg1Price.bid1?.price ? opportunity.leg1Price.bid1.price.toFixed(4) : '-'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#999' }}>買</div>
                  </div>
                  <div style={{ 
                    background: '#fff2f0', 
                    padding: '2px 4px', 
                    borderRadius: '3px',
                    flex: 1,
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#ff4d4f', fontWeight: '500' }}>
                      {opportunity.leg1Price.ask1?.price ? opportunity.leg1Price.ask1.price.toFixed(4) : '-'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#999' }}>賣</div>
                  </div>
                </div>
              ); })()}
            </div>
            
            {/* Leg2 價格 */}
            <div style={{ 
              background: '#fff0f6', 
              padding: '6px 8px', 
              borderRadius: '6px',
              border: '1px solid #ffd6e7'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '4px', 
                color: '#eb2f96',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{opportunity.leg2Price.symbol}</span>
                <span style={{ fontSize: '10px', color: '#666' }}>
                  {opportunity.leg2Price.exchange}
                </span>
              </div>
              {(() => { const leg2Side = (record as any)?.leg2?.side || (opportunity as any)?.pairConfig?.leg2?.side; return leg2Side ? (
                <div style={{ 
                  background: leg2Side === 'buy' ? '#fff2f0' : '#f6ffed',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  textAlign: 'center',
                  border: '1px solid ' + (leg2Side === 'buy' ? '#ffccc7' : '#b7eb8f')
                }}>
                  <div style={{ 
                    color: leg2Side === 'buy' ? '#ff4d4f' : '#52c41a',
                    fontWeight: 600
                  }}>
                    {(() => {
                      const price = leg2Side === 'buy' 
                        ? opportunity.leg2Price.ask1?.price 
                        : opportunity.leg2Price.bid1?.price;
                      return typeof price === 'number' ? price.toFixed(4) : '-';
                    })()}
                  </div>
                  <div style={{ fontSize: '9px', color: '#999' }}>
                    {leg2Side === 'buy' ? '按賣一成交' : '按買一成交'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ 
                    background: '#f6ffed', 
                    padding: '2px 4px', 
                    borderRadius: '3px',
                    flex: 1,
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#52c41a', fontWeight: '500' }}>
                      {opportunity.leg2Price.bid1?.price ? opportunity.leg2Price.bid1.price.toFixed(4) : '-'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#999' }}>買</div>
                  </div>
                  <div style={{ 
                    background: '#fff2f0', 
                    padding: '2px 4px', 
                    borderRadius: '3px',
                    flex: 1,
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#ff4d4f', fontWeight: '500' }}>
                      {opportunity.leg2Price.ask1?.price ? opportunity.leg2Price.ask1.price.toFixed(4) : '-'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#999' }}>賣</div>
                  </div>
                </div>
              ); })()}
            </div>
            
            {/* 更新時間 */}
            <div style={{ 
              textAlign: 'center', 
              fontSize: '9px', 
              color: '#999',
              marginTop: '2px'
            }}>
              {new Date(opportunity.timestamp).toLocaleTimeString()}
            </div>
          </Space>
        );
      },
    },
    {
      title: '當前價差',
      key: 'currentSpread',
      render: (record: any) => {
        const opportunity = currentOpportunities.find(o => o.id === record.id);
        if (!opportunity) {
          return <Text type="secondary">-</Text>;
        }
        
        return (
          <Space direction="vertical" size="small">
            <Text className={opportunity.spread > 0 ? 'price-positive' : 'price-negative'}>
              {opportunity.spreadPercent ? opportunity.spreadPercent.toFixed(3) : '-'}%
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {opportunity.spread ? opportunity.spread.toFixed(6) : '-'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '觸發閾值',
      dataIndex: 'threshold',
      key: 'threshold',
      render: (threshold: number) => `${threshold}%`,
    },
    {
      title: '交易數量',
      key: 'amount',
      render: (record: ArbitragePairExtended) => {
        // 使用 leg1 的交易對符號來確定幣種，添加安全檢查
        const symbol = record?.leg1?.symbol || record?.leg2?.symbol || 'BTCUSDT';
        const amount = record?.amount || 0;
        return formatAmountWithCurrency(amount, symbol);
      },
    },
    {
      title: '執行模式',
      dataIndex: 'executionMode',
      key: 'executionMode',
      render: (mode: string) => {
        const modeConfig = {
          market: { text: '市價單', color: 'orange', icon: '⚡' },
          threshold: { text: '等待差價', color: 'blue', icon: '⏳' }
        };
        const config = modeConfig[mode as keyof typeof modeConfig] || modeConfig.threshold;
        
        return (
          <Space>
            <span>{config.icon}</span>
            <Tag color={config.color}>{config.text}</Tag>
          </Space>
        );
      },
    },
    {
      title: '狀態',
      key: 'status',
      render: (record: any) => {
        const opportunity = currentOpportunities.find(o => o.id === record.id);
        const isTriggerable = opportunity?.shouldTrigger;
        
        return (
          <Space direction="vertical" size="small">
            <Switch
              checked={record.enabled}
              size="small"
              onChange={(checked) => handleToggleEnabled(record.id, checked)}
            />
            <Tag color={isTriggerable ? 'success' : record.enabled ? 'processing' : 'default'}>
              {isTriggerable ? '可觸發' : record.enabled ? '監控中' : '已停用'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '統計',
      key: 'stats',
      render: (record: any) => (
        <Space direction="vertical" size="small">
          <Text style={{ fontSize: '12px' }}>
            觸發: {record.totalTriggers}次
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.lastTriggered 
              ? `最後: ${new Date(record.lastTriggered).toLocaleString()}`
              : '未觸發'
            }
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: any) => {
        const opportunity = currentOpportunities.find(o => o.id === record.id);
        // 市價單模式：只要啟用就可以執行；等待差價模式：需要滿足閾值條件
        const canExecute = record.enabled && (
          record.executionMode === 'market' || 
          (record.executionMode === 'threshold' && opportunity?.shouldTrigger)
        );
        
        return (
          <Space>
            <Tooltip title={
              !record.enabled 
                ? '監控已暫停'
                : record.executionMode === 'market'
                  ? '市價單模式 - 點擊立即執行'
                  : canExecute 
                    ? `等待差價模式 - 可執行 (當前價差: ${opportunity?.spreadPercent?.toFixed(3) || 0}%)`
                    : '等待差價模式 - 等待價差達到閾值'
            }>
              <Button
                type={canExecute ? "primary" : "default"}
                size="small"
                icon={<PlayCircleOutlined />}
                disabled={!record.enabled}
                onClick={() => handleExecuteArbitrage(record.id)}
                style={{
                  backgroundColor: canExecute ? '#52c41a' : undefined,
                  borderColor: canExecute ? '#52c41a' : undefined,
                  animation: canExecute ? 'pulse 2s infinite' : undefined
                }}
              >
                {canExecute ? '執行' : '套利'}
              </Button>
            </Tooltip>
            <Tooltip title={record.enabled ? "暫停監控" : "啟用監控"}>
              <Button
                size="small"
                type={record.enabled ? "default" : "primary"}
                icon={record.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => handleToggleEnabled(record.id, !record.enabled)}
                style={{
                  color: record.enabled ? '#ff4d4f' : '#52c41a',
                  borderColor: record.enabled ? '#ff4d4f' : '#52c41a'
                }}
              >
                {record.enabled ? '暫停' : '啟用'}
              </Button>
            </Tooltip>
            <Tooltip title="編輯配置">
              <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Tooltip title="刪除">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <style>
        {`
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(82, 196, 26, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(82, 196, 26, 0);
            }
          }
        `}
      </style>
      {/* 頁面標題 */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>
            🔄 雙腿套利交易
          </Title>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadMonitoringPairs}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingPair(null);
                form.resetFields();
                setIsModalVisible(true);
              }}
              disabled={!isConnected}
            >
              添加監控對
            </Button>
          </Space>
        </Space>
      </div>

      {/* 連接狀態提示 */}
      {!isConnected && (
        <Alert
          message="系統未連接"
          description="請檢查網路連接，無法進行交易操作"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 交易所狀態概覽 */}
      <Card title="📊 交易所狀態" style={{ marginBottom: 24 }} className="card-shadow">
        <Row gutter={16}>
          {Object.entries(exchanges).map(([key, exchange]) => (
            <Col span={6} key={key}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Space direction="vertical" align="center" style={{ width: '100%' }}>
                  <Text strong style={{ fontSize: '16px' }}>{exchange.name}</Text>
                  <Tag 
                    color={
                      exchange.status === 'active' ? 'green' :
                      exchange.status === 'ready' ? 'blue' :
                      exchange.status === 'planned' ? 'orange' : 'default'
                    }
                  >
                    {exchange.status === 'active' ? '運行中' : 
                     exchange.status === 'ready' ? '就緒' : 
                     exchange.status === 'planned' ? '計劃中' : '未知'}
                  </Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>


      {/* 監控交易對列表 */}
      <Card title="📊 監控交易對" className="card-shadow">
        <Table
          columns={columns}
          dataSource={monitoringPairs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          locale={{ emptyText: '暫無監控交易對，點擊上方按鈕添加' }}
        />
      </Card>

      {/* 添加/編輯對話框 */}
      <Modal
        title={editingPair ? '編輯監控交易對' : '添加監控交易對'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingPair(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        {/* 調試信息 - 顯示可用交易所 */}
        {availableExchanges.length === 0 && (
          <Alert
            message="沒有可用的交易所"
            description="請先配置交易所API密鑰，或檢查系統連接狀態。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            enabled: true,
            threshold: 0.1,
          amount: 100.0, // 舊參數保留
          qty: 0.01,
          totalAmount: 1000,
          executionMode: 'threshold',
          }}
        >
          {/* 常用交易對快捷選擇 */}
          <Alert
            message="💡 常用交易對"
            description={
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'LTCUSDT'].map(symbol => (
                    <Button 
                      key={symbol}
                      size="small"
                      type="dashed"
                      onClick={() => {
                        form.setFieldValue('leg1_symbol', symbol);
                        form.setFieldValue('leg2_symbol', symbol);
                      }}
                      style={{ fontSize: '12px' }}
                    >
                      {symbol}
                    </Button>
                  ))}
                </Space>
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  點擊可快速填入兩個交易對，您也可以手動輸入其他交易對
                </div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={12}>
              <Card title="Leg 1 配置" size="small">
                <Form.Item
                  name="leg1_exchange"
                  label="交易所"
                  rules={[{ required: true, message: '請選擇交易所' }]}
                >
                  <Select placeholder="選擇交易所">
                    {availableExchanges.map(exchange => (
                      <Option 
                        key={exchange.key} 
                        value={exchange.key}
                        disabled={!exchange.connected && !exchange.implemented}
                      >
                        <Space>
                          <span>{exchange.name}</span>
                          <Tag 
                            color={
                              exchange.status === 'active' ? 'green' : 
                              exchange.status === 'ready' ? 'blue' : 
                              exchange.status === 'planned' ? 'orange' : 'default'
                            }
                          >
                            {exchange.status === 'active' ? '運行中' : 
                             exchange.status === 'ready' ? '就緒' : 
                             exchange.status === 'planned' ? '計劃中' : '未知'}
                          </Tag>
                          {!exchange.implemented && <Tag color="red">未實現</Tag>}
                          {!exchange.connected && exchange.implemented && <Tag color="yellow">未連接</Tag>}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg1_type"
                  label="交易類型"
                  rules={[{ required: true, message: '請選擇交易類型' }]}
                >
                  <Select placeholder="選擇類型">
                    <Option value="linear">線性合約</Option>
                    <Option value="inverse">反向合約</Option>
                    <Option value="spot">現貨</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg1_side"
                  label="買賣方向"
                  rules={[{ required: true, message: '請選擇買/賣方向' }]}
                >
                  <Select placeholder="選擇方向">
                    <Option value="buy">買入</Option>
                    <Option value="sell">賣出</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg1_symbol"
                  label="交易對"
                  rules={[
                    { required: true, message: '請輸入交易對' },
                    { 
                      pattern: /^[A-Z0-9]+USDT?$/i, 
                      message: '請輸入正確的交易對格式，如：BTCUSDT' 
                    }
                  ]}
                  extra="請輸入交易對符號，如：BTCUSDT, ETHUSDT 等"
                >
                  <Input 
                    placeholder="輸入交易對，如：BTCUSDT"
                    style={{ textTransform: 'uppercase' }}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      // 自動轉換為大寫
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('leg1_symbol', value);
                    }}
                  />
                </Form.Item>
              </Card>
            </Col>

            <Col span={12}>
              <Card title="Leg 2 配置" size="small">
                <Form.Item
                  name="leg2_exchange"
                  label="交易所"
                  rules={[{ required: true, message: '請選擇交易所' }]}
                >
                  <Select placeholder="選擇交易所">
                    {availableExchanges.map(exchange => (
                      <Option 
                        key={exchange.key} 
                        value={exchange.key}
                        disabled={!exchange.connected && !exchange.implemented}
                      >
                        <Space>
                          <span>{exchange.name}</span>
                          <Tag 
                            color={
                              exchange.status === 'active' ? 'green' : 
                              exchange.status === 'ready' ? 'blue' : 
                              exchange.status === 'planned' ? 'orange' : 'default'
                            }
                          >
                            {exchange.status === 'active' ? '運行中' : 
                             exchange.status === 'ready' ? '就緒' : 
                             exchange.status === 'planned' ? '計劃中' : '未知'}
                          </Tag>
                          {!exchange.implemented && <Tag color="red">未實現</Tag>}
                          {!exchange.connected && exchange.implemented && <Tag color="yellow">未連接</Tag>}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg2_type"
                  label="交易類型"
                  rules={[{ required: true, message: '請選擇交易類型' }]}
                >
                  <Select placeholder="選擇類型">
                    <Option value="linear">線性合約</Option>
                    <Option value="inverse">反向合約</Option>
                    <Option value="spot">現貨</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg2_side"
                  label="買賣方向"
                  rules={[{ required: true, message: '請選擇買/賣方向' }]}
                >
                  <Select placeholder="選擇方向">
                    <Option value="buy">買入</Option>
                    <Option value="sell">賣出</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg2_symbol"
                  label="交易對"
                  rules={[
                    { required: true, message: '請輸入交易對' },
                    { 
                      pattern: /^[A-Z0-9]+USDT?$/i, 
                      message: '請輸入正確的交易對格式，如：BTCUSDT' 
                    }
                  ]}
                  extra="請輸入交易對符號，如：BTCUSDT, ETHUSDT 等"
                >
                  <Input 
                    placeholder="輸入交易對，如：BTCUSDT"
                    style={{ textTransform: 'uppercase' }}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      // 自動轉換為大寫
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('leg2_symbol', value);
                    }}
                  />
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Divider />


          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="qty"
                label="每筆下單數量"
                rules={[
                  { required: true, message: '請輸入每筆下單數量' },
                  { type: 'number', min: 0.001, message: '數量必須大於 0.001' }
                ]}
                extra="每次觸發時的下單數量"
              >
                <InputNumber
                  min={0.001}
                  max={1000000}
                  step={0.001}
                  precision={8}
                  style={{ width: '100%' }}
                  placeholder="1.0"
                  addonAfter="幣"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => Number(value!.replace(/\$\s?|(,*)/g, '')) as any}
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                name="amount"
                label="總交易數量"
                rules={[
                  { required: true, message: '請輸入交易數量' },
                  { type: 'number', min: 0.001, message: '數量必須大於 0.001' }
                ]}
              >
                <InputNumber
                  min={0.001}
                  max={1000000}
                  step={0.001}
                  precision={8}
                  style={{ width: '100%' }}
                  placeholder="1.0"
                  addonAfter="幣"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => Number(value!.replace(/\$\s?|(,*)/g, '')) as any}
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                name="threshold"
                label={
                  <Space>
                    <span>觸發閾值 (%)</span>
                    <Form.Item name="executionMode" noStyle>
                    </Form.Item>
                  </Space>
                }
                rules={[{ required: true, message: '請輸入觸發閾值' }]}
                initialValue={0.1}
              >
                <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.executionMode !== currentValues.executionMode}>
                  {({ getFieldValue }) => (
                    <InputNumber
                      min={0.001}
                      max={10}
                      step={0.01}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="0.10"
                    />
                  )}
                </Form.Item>
              </Form.Item>
            </Col>

          </Row>


          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingPair ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ArbitragePage;
