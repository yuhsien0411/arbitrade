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
import { addMonitoringPair, removeMonitoringPair, updateMonitoringPair, updateOpportunity, setMonitoringPairs, setOpportunities, addExecution, clearExecutionHistory, setRecentExecutions, updatePairTriggerStats } from '../store/slices/arbitrageSlice';
import { updateExchanges } from '../store/slices/systemSlice';
import { formatAmountWithCurrency, getBaseCurrencyFromSymbol } from '../utils/formatters';
import logger from '../utils/logger';
import storage from '../utils/storage';

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
  const { monitoringPairs: rawMonitoringPairs, currentOpportunities, recentExecutions } = useSelector((state: RootState) => state.arbitrage);
  // 將 monitoringPairs 轉換為擴展類型以支援新參數，並確保數據完整性
  const monitoringPairs = (rawMonitoringPairs || []).filter((pair: any) => 
    pair && 
    typeof pair === 'object' && 
    pair.leg1 && 
    typeof pair.leg1 === 'object' && 
    pair.leg2 && 
    typeof pair.leg2 === 'object'
  ) as ArbitragePairExtended[];
  // 避免 effect 依賴變更導致反覆重建 interval：用 ref 保存最新列表
  const monitoringPairsRef = useRef<ArbitragePairExtended[]>(monitoringPairs);
  useEffect(() => { monitoringPairsRef.current = monitoringPairs; }, [monitoringPairs]);

  // 更新節流：對齊 bybit 的穩定感，每個 pair 最快 1s 更新一次
  const lastUpdateAtRef = useRef<Record<string, number>>({});
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPair, setEditingPair] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 立即檢查初始化狀態
  useEffect(() => {
    // 如果 Redux 狀態已經有數據，立即標記為已初始化
    if (monitoringPairs.length > 0 || rawMonitoringPairs.length === 0) {
      setIsInitialized(true);
    }
  }, [rawMonitoringPairs, monitoringPairs]);

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
        const normalized: ArbitragePairExtended[] = [] as any;
        response.data.forEach((pair: any) => {
          if (!pair || typeof pair !== 'object') return;
          // 確保數據結構正確，添加必要的預設值
          const normalizedPair = {
            ...(pair || {}),
            leg1: {
              ...(pair?.leg1 || {}),
              side: pair.leg1?.side || 'buy',
              type: pair.leg1?.type || 'spot'
            },
            leg2: {
              ...(pair?.leg2 || {}),
              side: pair.leg2?.side || 'sell',
              // 避免預設為 linear 導致兩腿都變合約；安全預設為 spot
              type: pair.leg2?.type || 'spot'
            },
            threshold: pair.threshold ?? 0.1,
            qty: pair.qty || 0.001,
            amount: pair.qty || 0.001,
            enabled: pair.enabled !== false,
            maxExecs: pair.maxExecs || 1,
            executionsCount: pair.executionsCount || 0,
            createdAt: pair.createdAt || Date.now(),
            lastTriggered: pair.lastTriggered || null,
            totalTriggers: pair.totalTriggers || 0
          };
          if (normalizedPair.leg1?.exchange && normalizedPair.leg1?.symbol && normalizedPair.leg2?.exchange && normalizedPair.leg2?.symbol) {
            normalized.push(normalizedPair);
          }
        });
        // 以一次性覆蓋，避免殘留舊資料
        dispatch(setMonitoringPairs(normalized as any));
        
        // 更新觸發統計
        normalized.forEach((pair: any) => {
          if (pair.totalTriggers !== undefined || pair.lastTriggered !== undefined) {
            dispatch(updatePairTriggerStats({
              pairId: pair.id,
              totalTriggers: pair.totalTriggers || 0,
              lastTriggered: pair.lastTriggered || null
            }));
          }
        });
        
        logger.info('已載入套利監控對', { count: normalized.length }, 'ArbitragePage');
      } else {
        // 如果後端沒有數據，嘗試從本地存儲載入
        const localPairs = storage.load(storage.keys.MONITORING_PAIRS, []);
        if (Array.isArray(localPairs) && localPairs.length > 0) {
          dispatch(setMonitoringPairs(localPairs as any));
          logger.info('從本地存儲載入套利監控對', { count: localPairs.length }, 'ArbitragePage');
        }
      }
    } catch (error) {
      logger.error('載入監控交易對失敗', error, 'ArbitragePage');
      // 如果後端載入失敗，嘗試從本地存儲載入
      try {
        const localPairs = storage.load(storage.keys.MONITORING_PAIRS, []);
        if (Array.isArray(localPairs) && localPairs.length > 0) {
          dispatch(setMonitoringPairs(localPairs as any));
          logger.info('從本地存儲載入套利監控對（後端失敗）', { count: localPairs.length }, 'ArbitragePage');
        }
      } catch (localError) {
        logger.error('從本地存儲載入失敗', localError, 'ArbitragePage');
      }
    }
  }, [dispatch]);

  // 處理 WebSocket 推送的價格更新
  useEffect(() => {
    // 計算「可套利」定義的差價：賣腿可成交價 − 買腿可成交價
    const computeProfitableSpread = (pairCfg: any, leg1Price: any, leg2Price: any) => {
      const leg1Side = pairCfg?.leg1?.side || 'buy';
      const leg2Side = pairCfg?.leg2?.side || 'sell';
      const leg1Exec = leg1Side === 'buy' ? leg1Price?.ask1?.price : leg1Price?.bid1?.price;
      const leg2Exec = leg2Side === 'buy' ? leg2Price?.ask1?.price : leg2Price?.bid1?.price;
      // 將兩腿拆成 buyLeg / sellLeg 後計算 sell − buy
      const buyExec = leg1Side === 'buy' ? leg1Exec : leg2Exec;
      const sellExec = leg1Side === 'sell' ? leg1Exec : leg2Exec;
      const spread = (typeof sellExec === 'number' && typeof buyExec === 'number') ? (sellExec - buyExec) : 0;
      const base = (typeof buyExec === 'number' && buyExec > 0) ? buyExec : 1;
      const spreadPct = (spread / base) * 100;
      return { spread, spreadPct };
    };

    const handlePriceUpdate = (event: any) => {
      try {
        const payload = event.detail || event;
        const msgType = payload?.type;
        const body = payload?.data || payload; // 兼容 {type, data} 與直接傳物件
        if (msgType === 'priceUpdate' && body && (body.id || (body.pairConfig && body.pairConfig.id))) {
          const { id, leg1Price, leg2Price, threshold, pairConfig } = body;
          const { spread, spreadPct } = computeProfitableSpread(pairConfig, leg1Price, leg2Price);
          
          // 更新對應監控對的價格數據
          const opportunity = {
            id,
            // 使用後端提供的 pairConfig，若缺失則以安全預設構建，確保型別正確
            pairConfig: (() => {
              if (pairConfig && pairConfig.leg1 && pairConfig.leg2) {
                return {
                  id: pairConfig.id || id,
                  leg1: {
                    exchange: pairConfig.leg1?.exchange || leg1Price.exchange,
                    symbol: pairConfig.leg1?.symbol || leg1Price.symbol,
                    type: (pairConfig.leg1?.type as any) || 'spot',
                    side: (pairConfig.leg1?.side as any) || 'buy'
                  },
                  leg2: {
                    exchange: pairConfig.leg2?.exchange || leg2Price.exchange,
                    symbol: pairConfig.leg2?.symbol || leg2Price.symbol,
                    type: (pairConfig.leg2?.type as any) || 'spot',
                    side: (pairConfig.leg2?.side as any) || 'sell'
                  },
                  threshold: typeof pairConfig.threshold === 'number' ? pairConfig.threshold : threshold,
                  amount: 0,
                  enabled: true,
                  createdAt: Date.now(),
                  lastTriggered: null,
                  totalTriggers: 0
                } as any;
              }
              // 後端未提供 pairConfig 時的保底
              return {
                id,
                leg1: { exchange: leg1Price.exchange, symbol: leg1Price.symbol, type: 'spot', side: 'buy' },
                leg2: { exchange: leg2Price.exchange, symbol: leg2Price.symbol, type: 'spot', side: 'sell' },
                threshold: threshold,
                amount: 0,
                enabled: true,
                createdAt: Date.now(),
                lastTriggered: null,
                totalTriggers: 0
              } as any;
            })(),
            leg1Price,
            leg2Price,
            spread,
            spreadPercent: spreadPct,
            threshold,
            shouldTrigger: spreadPct >= threshold,
            timestamp: Date.now(),
            direction: 'leg1_buy_leg2_sell' as 'leg1_buy_leg2_sell' | 'leg1_sell_leg2_buy'
          };
          
          // 更新 Redux 狀態
          dispatch(updateOpportunity(opportunity));
          
          logger.info('收到價格更新', { id, spreadPercent: spreadPct, threshold }, 'ArbitragePage');
        }
      } catch (error) {
        logger.error('處理價格更新失敗', error, 'ArbitragePage');
      }
    };

    // 監聽自定義事件
    window.addEventListener('priceUpdate', handlePriceUpdate);
    
    return () => {
      window.removeEventListener('priceUpdate', handlePriceUpdate);
    };
  }, [dispatch]);

  // 載入監控交易對和價格數據
  useEffect(() => {
    // 延遲載入，確保後端已啟動
    const loadDelay = setTimeout(async () => {
      try {
        await loadMonitoringPairs();
        setIsInitialized(true);
      } catch (error) {
        console.error('初始化失敗:', error);
        setIsInitialized(true); // 即使失敗也標記為已初始化，避免無限載入
      }
    }, 1000);
    
    // 加載交易所狀態（只有在有連接時才載入）
    if (isConnected) {
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
    }
    
    // 設置定時重新載入監控交易對（調整為每5秒，提高刷新頻率）
    const reloadInterval = setInterval(() => {
      if (isConnected) {
        loadMonitoringPairs();
      }
    }, 5 * 1000);
    
    // 簡化價格獲取邏輯，主要依賴WebSocket推送
    const fetchTickerData = async () => {
      try {
        const pairs = monitoringPairsRef.current || [];
        if (pairs.length === 0) {
          dispatch(setOpportunities([] as any));
          return;
        }
        
        // 以本頁面的節流 ref 為準，避免 Redux 閉包造成判斷過期
        for (const pair of pairs) {
          const lastAt = lastUpdateAtRef.current[pair.id] || 0;
          if (lastAt > Date.now() - 1000) {
            continue; // 1 秒內已更新過
          }
          
          try {
            if (!pair || !pair.leg1 || !pair.leg2) continue;
            
            const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:7001';
            // 根據交易對類型構建正確的API URL
            const getPriceUrl = (exchange: string, symbol: string, type: string) => {
              if (exchange === 'bybit') {
                const category = type === 'linear' ? 'linear' : 'spot';
                return `${apiBase}/api/prices/${exchange}/${symbol}?category=${category}`;
              }
              return `${apiBase}/api/prices/${exchange}/${symbol}`;
            };
            
            const [leg1Res, leg2Res] = await Promise.allSettled([
              fetch(getPriceUrl(pair.leg1.exchange, pair.leg1.symbol, pair.leg1.type)),
              fetch(getPriceUrl(pair.leg2.exchange, pair.leg2.symbol, pair.leg2.type))
            ]);
            
            if (leg1Res.status === 'fulfilled' && leg2Res.status === 'fulfilled') {
              const leg1Data = await leg1Res.value.json();
              const leg2Data = await leg2Res.value.json();
              
              if (leg1Data.success && leg2Data.success) {
                const leg1Bid = Number(leg1Data.data.bids?.[0]?.[0] || 0);
                const leg1Ask = Number(leg1Data.data.asks?.[0]?.[0] || 0);
                const leg2Bid = Number(leg2Data.data.bids?.[0]?.[0] || 0);
                const leg2Ask = Number(leg2Data.data.asks?.[0]?.[0] || 0);
                
                if (leg1Bid > 0 && leg1Ask > 0 && leg2Bid > 0 && leg2Ask > 0) {
                  const leg1Side = pair.leg1.side || 'buy';
                  const leg2Side = pair.leg2.side || 'sell';
                const leg1ExecPrice = leg1Side === 'buy' ? leg1Ask : leg1Bid;
                const leg2ExecPrice = leg2Side === 'buy' ? leg2Ask : leg2Bid;
                // 以「可套利」定義：sell − buy
                const sellExec = leg1Side === 'sell' ? leg1ExecPrice : leg2ExecPrice;
                const buyExec  = leg1Side === 'buy'  ? leg1ExecPrice : leg2ExecPrice;
                const spread = sellExec - buyExec;
                const spreadPercent = buyExec > 0 ? (spread / buyExec) * 100 : 0;
                  
                  const opportunity = {
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
                      symbol: pair.leg1.symbol,
                      exchange: pair.leg1.exchange,
                      bid1: { price: leg1Bid, amount: 0 },
                      ask1: { price: leg1Ask, amount: 0 }
                    },
                    leg2Price: {
                      symbol: pair.leg2.symbol,
                      exchange: pair.leg2.exchange,
                      bid1: { price: leg2Bid, amount: 0 },
                      ask1: { price: leg2Ask, amount: 0 }
                    },
                    spread,
                    spreadPercent,
                    threshold: pair.threshold ?? 0.1,
                    shouldTrigger: spreadPercent >= (pair.threshold ?? 0.1),
                    timestamp: Date.now(),
                    direction: (leg1Side === 'sell' && leg2Side === 'buy') ? 'leg1_sell_leg2_buy' as 'leg1_buy_leg2_sell' | 'leg1_sell_leg2_buy' : 'leg1_buy_leg2_sell' as 'leg1_buy_leg2_sell' | 'leg1_sell_leg2_buy'
                  };
                  
                  dispatch(updateOpportunity(opportunity));
                  lastUpdateAtRef.current[pair.id] = Date.now();
                }
              }
            }
          } catch (error) {
            logger.error(`獲取交易對 ${pair.id} 價格失敗`, error, 'ArbitragePage');
          }
        }
      } catch (error) {
        logger.error('獲取實時價格失敗', error, 'ArbitragePage');
      }
    };

    // 載入執行歷史，將已完成的進程顯示到最近執行記錄
    const fetchExecutions = async () => {
      try {
        const res = await apiService.getArbitrageExecutions();
        const hist = (res as any)?.data || {};
        // 聚合每個 pair 的成功次數與最後時間
        const agg: Record<string, { total: number; lastTs: number }> = {};
        Object.values(hist || {}).forEach((list: any) => {
          (list as any[]).forEach((item) => {
                    // 安全檢查：確保 item 和其屬性存在
                    if (!item || !item.leg1 || !item.leg2) return;
            const pid = item.pairId || 'unknown';
            const pair = (monitoringPairsRef.current || []).find(p => p.id === pid);
                    
                    dispatch(addExecution({
                      opportunity: {
                id: pid,
                // 直接以歷史記錄的腿資訊為主，確保 type/side 正確
                pairConfig: ({
                  id: pid,
                  leg1: {
                    exchange: item.leg1?.exchange || pair?.leg1?.exchange,
                    symbol: item.leg1?.symbol || pair?.leg1?.symbol,
                    type: item.leg1?.type || pair?.leg1?.type || 'spot',
                    side: item.leg1?.side || pair?.leg1?.side || 'buy'
                  },
                  leg2: {
                    exchange: item.leg2?.exchange || pair?.leg2?.exchange,
                    symbol: item.leg2?.symbol || pair?.leg2?.symbol,
                    type: item.leg2?.type || pair?.leg2?.type || 'spot',
                    side: item.leg2?.side || pair?.leg2?.side || 'sell'
                  },
                  qty: Number.isFinite(Number(item.qty)) ? Number(item.qty) : (pair?.qty)
                } as any),
                        leg1Price: { 
                          symbol: item.leg1?.symbol || 'N/A', 
                          exchange: item.leg1?.exchange || 'N/A', 
                          bid1: null, 
                          ask1: null 
                        },
                        leg2Price: { 
                          symbol: item.leg2?.symbol || 'N/A', 
                          exchange: item.leg2?.exchange || 'N/A', 
                          bid1: null, 
                          ask1: null 
                        },
                        spread: 0,
                        spreadPercent: 0,
                        threshold: 0,
                        shouldTrigger: false,
                        status: (item.success === false ? 'failed' : (item.status || 'success')),
                        timestamp: item.ts || Date.now(),
                        direction: 'leg1_buy_leg2_sell' as 'leg1_buy_leg2_sell' | 'leg1_sell_leg2_buy'
                      },
                      // 於記錄層級也保留數量
                      amount: (Number.isFinite(Number(item.qty)) ? Number(item.qty) : undefined) as any,
                      result: {
                        leg1OrderId: item.leg1?.orderId || 'N/A',
                        leg2OrderId: item.leg2?.orderId || 'N/A'
                      },
                      success: item.success !== false,
                      timestamp: item.ts || Date.now()
                    } as any));

            // 聚合成功次數（歷史接口默認為成功記錄）
            const ts = item.ts || Date.now();
            if (!agg[pid]) agg[pid] = { total: 0, lastTs: 0 };
            agg[pid].total += 1;
            agg[pid].lastTs = Math.max(agg[pid].lastTs, ts);
                  });
        });

        // 將聚合結果同步到觸發統計，讓進度顯示正確
        Object.entries(agg).forEach(([pairId, v]) => {
          dispatch(updatePairTriggerStats({
            pairId,
            totalTriggers: v.total,
            lastTriggered: v.lastTs || null
          }));
        });
      } catch {}
    };

    // 先立即抓一次，只有在有交易對時才獲取數據
    const pairs = monitoringPairsRef.current || [];
    if (pairs.length > 0) {
      fetchTickerData();
    }
    fetchExecutions();

    // 定期獲取價格數據（只有在有交易對時才輪詢，間隔調整為1秒）
    const priceInterval = setInterval(() => {
      const pairs = monitoringPairsRef.current || [];
      // 即使 WS 未連線也啟用 HTTP 後備輪詢；
      // fetchTickerData 內部會檢查 1 秒內是否已有更新，避免浪費請求
      if (pairs.length > 0) {
        fetchTickerData();
      }
    }, 1 * 1000); // 調整為 1 秒，更即時

    // 清理定時器
    return () => {
      clearTimeout(loadDelay);
      clearInterval(reloadInterval);
      clearInterval(priceInterval);
    };
  }, [dispatch, loadMonitoringPairs, isConnected]);

  // 添加/更新監控交易對
  const handleSubmit = async (values: any) => {
    try {
      logger.info('開始提交監控交易對表單', values, 'ArbitragePage');
      setLoading(true);
      
      // 生成唯一 ID（如果沒有編輯中的交易對）
      const pairId = editingPair?.id || `pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // 正規化交易所值：防止選單返回索引 '0' / '1'
      const normalizeExchange = (v: any) => {
        if (v === '0') return 'bybit';
        if (v === '1') return 'binance';
        return (v || 'bybit').toString();
      };
      
      // 構建符合後端API的請求格式
      const qty = Number(values.qty || values.sliceQty || 0.01);
      const maxExecs = Number(values.orderCount || 1);
      const totalAmount = qty * maxExecs;
      
      const arbitrageConfig = {
        pairId: pairId,
        leg1: {
          exchange: normalizeExchange(values.leg1_exchange),
          symbol: values.leg1_symbol || 'BTCUSDT',
          type: (values.leg1_type === 'future' ? 'linear' : values.leg1_type) || 'spot',
          side: values.leg1_side || 'buy',
        },
        leg2: {
          exchange: normalizeExchange(values.leg2_exchange),
          symbol: values.leg2_symbol || 'BTCUSDT',
          type: (values.leg2_type === 'future' ? 'linear' : values.leg2_type) || 'spot',
          side: values.leg2_side || 'sell',
        },
        threshold: Number(values.threshold ?? 0.1),
        qty: qty,
        totalAmount: totalAmount,
        enabled: values.enabled ?? true,
        maxExecs: maxExecs
      };

      // 同時構建前端顯示用的配置
      const config: MonitoringPairConfig = {
        id: pairId,
        leg1: arbitrageConfig.leg1,
        leg2: arbitrageConfig.leg2,
        threshold: arbitrageConfig.threshold,
        enabled: arbitrageConfig.enabled,
        executionMode: values.executionMode || 'threshold',
        qty: arbitrageConfig.qty,
        totalAmount: arbitrageConfig.qty * arbitrageConfig.maxExecs,
        amount: arbitrageConfig.qty
      };

      logger.info('構建的監控配置', config, 'ArbitragePage');

      let response;
      if (editingPair) {
        logger.info('更新現有監控交易對', editingPair.id, 'ArbitragePage');
        // 更新時使用套利引擎API
        const updateData = { 
          enabled: arbitrageConfig.enabled,
          threshold: arbitrageConfig.threshold,
          qty: arbitrageConfig.qty,
          totalAmount: arbitrageConfig.totalAmount,
          maxExecs: arbitrageConfig.maxExecs
        };
        response = await apiService.updateArbitragePair(editingPair.id, updateData);
        logger.info('更新響應', response, 'ArbitragePage');
      } else {
        logger.info('添加新監控交易對', null, 'ArbitragePage');
        response = await apiService.upsertArbitragePair(arbitrageConfig);
        logger.info('添加響應', response, 'ArbitragePage');
      }

      if (response && (response as any).success !== false) {
        logger.info('操作成功，更新 Redux 狀態', response, 'ArbitragePage');
        
        // 構建完整的ArbitragePair對象
        const fullPair = {
          ...config,
          id: pairId, // 確保id是string類型
          amount: config.qty || 0, // 確保amount是number類型
          enabled: config.enabled ?? true, // 確保enabled是boolean類型
          createdAt: Date.now(),
          lastTriggered: null,
          totalTriggers: 0
        };
        
        dispatch(addMonitoringPair(fullPair));
        
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
          await apiService.removeArbitragePair(id);
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
      await apiService.updateArbitragePair(id, { enabled });
      dispatch(updateMonitoringPair({ id, updates: { enabled } }));
      message.success(enabled ? '已啟用' : '已停用');
    } catch (error: any) {
      message.error(error.message || '操作失敗');
    }
  };


  // 編輯監控交易對
  const handleEdit = (pair: any) => {
    // 安全檢查：確保 pair 和其屬性存在
    if (!pair || !pair.leg1 || !pair.leg2) {
      message.error('交易對數據不完整，無法編輯');
      return;
    }
    
    setEditingPair(pair);
    form.setFieldsValue({
      leg1_exchange: pair.leg1?.exchange || 'bybit',
      leg1_symbol: pair.leg1?.symbol || 'BTCUSDT',
      leg1_type: pair.leg1?.type || 'linear',
      leg1_side: pair.leg1?.side || 'buy',
      leg2_exchange: pair.leg2?.exchange || 'bybit',
      leg2_symbol: pair.leg2?.symbol || 'BTCUSDT',
      leg2_type: pair.leg2?.type || 'spot',
      leg2_side: pair.leg2?.side || 'sell',
      // 保留原本已設定的數值，避免開啟編輯時被預設值覆蓋
      qty: typeof pair.qty === 'number' ? pair.qty : (typeof pair.amount === 'number' ? pair.amount : undefined),
      orderCount: typeof pair.maxExecs === 'number' ? pair.maxExecs : (typeof pair.orderCount === 'number' ? pair.orderCount : undefined),
      threshold: typeof pair.threshold === 'number' ? pair.threshold : 0.1,
      amount: typeof pair.amount === 'number' ? pair.amount : undefined,
      enabled: pair.enabled ?? true,
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
        try {
          // 防禦：若資料尚未齊全，不渲染內容以避免報錯
          if (!record || !record.leg1) {
            return <Text type="secondary">數據載入中...</Text>;
          }
          
          const leg1 = record.leg1;
          // 額外檢查 leg1 是否為有效對象
          if (!leg1 || typeof leg1 !== 'object') {
            return <Text type="secondary">數據不完整...</Text>;
          }
          
          return (
            <Space direction="vertical" size="small">
              <Text strong>{leg1?.symbol || 'N/A'}</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {exchanges[leg1?.exchange]?.name || leg1?.exchange || 'N/A'} {
                  leg1?.type === 'spot' ? '現貨' : 
                  leg1?.type === 'linear' ? '線性合約' : 
                  leg1?.type === 'inverse' ? '反向合約' : 
                  leg1?.type === 'future' ? '線性合約' : leg1?.type || 'N/A'
                } · {leg1?.side === 'sell' ? '賣出' : '買入'}
              </Text>
            </Space>
          );
        } catch (error) {
          console.error('Leg1 render error:', error, record);
          return <Text type="secondary">渲染錯誤</Text>;
        }
      },
    },
    {
      title: 'Leg 2',
      key: 'leg2',
      render: (record: any) => {
        try {
          // 防禦：若資料尚未齊全，不渲染內容以避免報錯
          if (!record || !record.leg2) {
            return <Text type="secondary">數據載入中...</Text>;
          }
          
          const leg2 = record.leg2;
          // 額外檢查 leg2 是否為有效對象
          if (!leg2 || typeof leg2 !== 'object') {
            return <Text type="secondary">數據不完整...</Text>;
          }
          
          return (
            <Space direction="vertical" size="small">
              <Text strong>{leg2?.symbol || 'N/A'}</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {exchanges[leg2?.exchange]?.name || leg2?.exchange || 'N/A'} {
                  leg2?.type === 'spot' ? '現貨' : 
                  leg2?.type === 'linear' ? '線性合約' : 
                  leg2?.type === 'inverse' ? '反向合約' : 
                  leg2?.type === 'future' ? '線性合約' : leg2?.type || 'N/A'
                } · {leg2?.side === 'sell' ? '賣出' : '買入'}
              </Text>
            </Space>
          );
        } catch (error) {
          console.error('Leg2 render error:', error, record);
          return <Text type="secondary">渲染錯誤</Text>;
        }
      },
    },
    {
      title: '實時價格',
      key: 'realtimePrices',
      render: (record: any) => {
        try {
          // 安全檢查：確保 record 存在且是監控交易對
          if (!record || !record.leg1 || !record.leg2) {
            return <Text type="secondary">數據不完整...</Text>;
          }
          
          const opportunity = currentOpportunities.find(o => o.id === record.id);
          if (!opportunity || !opportunity.leg1Price || !opportunity.leg2Price) {
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
              {(() => { 
                // 安全獲取 leg1Side，優先從 opportunity 獲取，再從 record 獲取
                const leg1Side = opportunity?.pairConfig?.leg1?.side || (record && record.leg1 ? record.leg1.side : null) || 'buy'; 
                return leg1Side ? (
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
                        ? opportunity?.leg1Price?.ask1?.price 
                        : opportunity?.leg1Price?.bid1?.price;
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
                      {opportunity?.leg1Price?.bid1?.price ? opportunity.leg1Price.bid1.price.toFixed(4) : '-'}
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
                      {opportunity?.leg1Price?.ask1?.price ? opportunity.leg1Price.ask1.price.toFixed(4) : '-'}
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
              {(() => { 
                // 安全獲取 leg2Side，優先從 opportunity 獲取，再從 record 獲取
                const leg2Side = opportunity?.pairConfig?.leg2?.side || (record && record.leg2 ? record.leg2.side : null) || 'sell'; 
                return leg2Side ? (
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
                        ? opportunity?.leg2Price?.ask1?.price 
                        : opportunity?.leg2Price?.bid1?.price;
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
                      {opportunity?.leg2Price?.bid1?.price ? opportunity.leg2Price.bid1.price.toFixed(4) : '-'}
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
                      {opportunity?.leg2Price?.ask1?.price ? opportunity.leg2Price.ask1.price.toFixed(4) : '-'}
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
        } catch (error) {
          console.error('實時價格渲染錯誤:', error, record);
          return <Text type="secondary">渲染錯誤</Text>;
        }
      },
    },
    {
      title: '當前價差',
      key: 'currentSpread',
      render: (record: any) => {
        const opportunity = currentOpportunities.find(o => o.id === record.id);
        if (!opportunity || typeof opportunity.spreadPercent !== 'number') {
          return <Text type="secondary">-</Text>;
        }
        
        const isPositive = opportunity.spreadPercent > 0;
        const colorClass = isPositive ? 'price-positive' : 'price-negative';
        
        return (
          <Space direction="vertical" size="small">
            <Text className={colorClass}>
              {opportunity.spreadPercent.toFixed(3)}%
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
      render: (threshold: number) => (typeof threshold === 'number' ? `${threshold}%` : '-'),
    },
    {
      title: '交易數量',
      key: 'amount',
      render: (record: ArbitragePairExtended) => {
        // 安全檢查：確保 record 存在
        if (!record) {
          return <Text type="secondary">-</Text>;
        }
        
        // 顯示 base 幣別（如 BTCUSDT -> BTC）
        const symbol = record?.leg1?.symbol || record?.leg2?.symbol || 'BTCUSDT';
        const base = getBaseCurrencyFromSymbol(symbol);
        const amount = record?.amount || record?.qty || 0;
        return formatAmountWithCurrency(amount, base);
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
          
          .price-positive {
            color: #52c41a !important;
            font-weight: 600;
          }
          
          .price-negative {
            color: #ff4d4f !important;
            font-weight: 600;
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
              icon={<ReloadOutlined />} 
              onClick={() => {
                // 立即觸發價格數據獲取
                const pairs = monitoringPairsRef.current || [];
                if (pairs.length > 0) {
                  const fetchTickerData = async () => {
                    try {
                      for (const pair of pairs) {
                        try {
                          if (!pair || !pair.leg1 || !pair.leg2) continue;
                          
                          const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:7001';
                          // 根據交易對類型構建正確的API URL
                          const getPriceUrl = (exchange: string, symbol: string, type: string) => {
                            if (exchange === 'bybit') {
                              const category = type === 'linear' ? 'linear' : 'spot';
                              return `${apiBase}/api/prices/${exchange}/${symbol}?category=${category}`;
                            }
                            return `${apiBase}/api/prices/${exchange}/${symbol}`;
                          };
                          
                          const [leg1Res, leg2Res] = await Promise.allSettled([
                            fetch(getPriceUrl(pair.leg1.exchange, pair.leg1.symbol, pair.leg1.type)),
                            fetch(getPriceUrl(pair.leg2.exchange, pair.leg2.symbol, pair.leg2.type))
                          ]);
                          
                          if (leg1Res.status === 'fulfilled' && leg2Res.status === 'fulfilled') {
                            const leg1Data = await leg1Res.value.json();
                            const leg2Data = await leg2Res.value.json();
                            
                            if (leg1Data.success && leg2Data.success) {
                              const leg1Bid = Number(leg1Data.data.bids?.[0]?.[0] || 0);
                              const leg1Ask = Number(leg1Data.data.asks?.[0]?.[0] || 0);
                              const leg2Bid = Number(leg2Data.data.bids?.[0]?.[0] || 0);
                              const leg2Ask = Number(leg2Data.data.asks?.[0]?.[0] || 0);
                              
                              if (leg1Bid > 0 && leg1Ask > 0 && leg2Bid > 0 && leg2Ask > 0) {
                                const leg1Side = pair.leg1.side || 'buy';
                                const leg2Side = pair.leg2.side || 'sell';
                                const leg1ExecPrice = leg1Side === 'buy' ? leg1Ask : leg1Bid;
                                const leg2ExecPrice = leg2Side === 'buy' ? leg2Ask : leg2Bid;
                                const mid = (leg1ExecPrice + leg2ExecPrice) / 2;
                                const spread = leg2ExecPrice - leg1ExecPrice;
                                const spreadPercent = mid > 0 ? (spread / mid) * 100 : 0;
                                
                                const opportunity = {
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
                                    symbol: pair.leg1.symbol,
                                    exchange: pair.leg1.exchange,
                                    bid1: { price: leg1Bid, amount: 0 },
                                    ask1: { price: leg1Ask, amount: 0 }
                                  },
                                  leg2Price: {
                                    symbol: pair.leg2.symbol,
                                    exchange: pair.leg2.exchange,
                                    bid1: { price: leg2Bid, amount: 0 },
                                    ask1: { price: leg2Ask, amount: 0 }
                                  },
                                  spread,
                                  spreadPercent,
                                  threshold: pair.threshold ?? 0.1,
                                  shouldTrigger: Math.abs(spreadPercent) >= (pair.threshold ?? 0.1),
                                  timestamp: Date.now(),
                                  direction: (leg1Side === 'sell' && leg2Side === 'buy') ? 'leg1_sell_leg2_buy' as 'leg1_buy_leg2_sell' | 'leg1_sell_leg2_buy' : 'leg1_buy_leg2_sell' as 'leg1_buy_leg2_sell' | 'leg1_sell_leg2_buy'
                                };
                                
                                dispatch(updateOpportunity(opportunity));
                              }
                            }
                          }
                        } catch (error) {
                          logger.error(`獲取交易對 ${pair.id} 價格失敗`, error, 'ArbitragePage');
                        }
                      }
                    } catch (error) {
                      logger.error('獲取實時價格失敗', error, 'ArbitragePage');
                    }
                  };
                  fetchTickerData();
                }
              }}
            >
              載入價格
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




      {/* 監控交易對列表 */}
      <Card title="📊 監控交易對" className="card-shadow">
        {!isInitialized ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">正在初始化數據...</Text>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={monitoringPairs.filter(pair => {
              // 嚴格的數據驗證
              return pair && 
                     typeof pair === 'object' && 
                     pair.id && 
                     pair.leg1 && 
                     typeof pair.leg1 === 'object' && 
                     pair.leg1.exchange && 
                     pair.leg1.symbol && 
                     pair.leg2 && 
                     typeof pair.leg2 === 'object' && 
                     pair.leg2.exchange && 
                     pair.leg2.symbol;
            }).map(pair => ({
              ...pair,
              // 確保 leg1 和 leg2 是有效對象
              leg1: pair.leg1 && typeof pair.leg1 === 'object' ? pair.leg1 : null,
              leg2: pair.leg2 && typeof pair.leg2 === 'object' ? pair.leg2 : null
            }))}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1000 }}
            locale={{ emptyText: '暫無監控交易對，點擊上方按鈕添加' }}
          />
        )}
      </Card>

      {/* 最近執行記錄 */}
      <Card
        title={<Space><span>🕘 最近執行記錄</span><Tag color="blue">最多顯示20筆</Tag></Space>}
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Button size="small" onClick={async () => {
              try {
                const res = await apiService.getArbitrageExecutions();
                const hist = (res as any)?.data || {};
                // 將後端歷史轉為標準結構並覆蓋最近執行記錄，避免每次刷新累加
                const merged: any[] = [];
                const agg: Record<string, { total: number; lastTs: number }> = {};
                Object.values(hist || {}).forEach((list: any) => {
                  if (!Array.isArray(list)) return;
                  (list as any[]).forEach((item) => {
                    // 安全檢查：確保 item 和其屬性存在
                    if (!item || typeof item !== 'object') return;
                    if (!item.leg1 || !item.leg2 || typeof item.leg1 !== 'object' || typeof item.leg2 !== 'object') return;
                    const pid = item.pairId || 'unknown';
                    const pair = (monitoringPairsRef.current || []).find(p => p.id === pid);
                    
                    merged.push({
                      opportunity: {
                        id: pid,
                        // 以歷史腿資訊為主
                        pairConfig: ({
                          id: pid,
                          leg1: {
                            exchange: item.leg1?.exchange || pair?.leg1?.exchange,
                            symbol: item.leg1?.symbol || pair?.leg1?.symbol,
                            type: item.leg1?.type || pair?.leg1?.type || 'spot',
                            side: item.leg1?.side || pair?.leg1?.side || 'buy'
                          },
                          leg2: {
                            exchange: item.leg2?.exchange || pair?.leg2?.exchange,
                            symbol: item.leg2?.symbol || pair?.leg2?.symbol,
                            type: item.leg2?.type || pair?.leg2?.type || 'spot',
                            side: item.leg2?.side || pair?.leg2?.side || 'sell'
                          },
                          qty: Number.isFinite(Number(item.qty)) ? Number(item.qty) : (pair?.qty)
                        } as any),
                        leg1Price: { 
                          symbol: item.leg1?.symbol || 'N/A', 
                          exchange: item.leg1?.exchange || 'N/A', 
                          bid1: null, 
                          ask1: null 
                        },
                        leg2Price: { 
                          symbol: item.leg2?.symbol || 'N/A', 
                          exchange: item.leg2?.exchange || 'N/A', 
                          bid1: null, 
                          ask1: null 
                        },
                        spread: 0,
                        spreadPercent: 0,
                        threshold: 0,
                        shouldTrigger: false,
                        status: (item.success === false ? 'failed' : (item.status || 'success')),
                        timestamp: item.ts || Date.now(),
                        direction: 'leg1_buy_leg2_sell' as 'leg1_buy_leg2_sell' | 'leg1_sell_leg2_buy'
                      },
                      result: { 
                        leg1OrderId: item.leg1?.orderId || 'N/A', 
                        leg2OrderId: item.leg2?.orderId || 'N/A' 
                      },
                      // 直接在記錄層級保留 qty，供表格顯示
                      amount: (Number.isFinite(Number(item.qty)) ? Number(item.qty) : undefined) as any,
                      success: item.success !== false,
                      timestamp: item.ts || Date.now()
                    });

                    // 聚合成功次數
                    const ts = item.ts || Date.now();
                    if (!agg[pid]) agg[pid] = { total: 0, lastTs: 0 };
                    agg[pid].total += 1;
                    agg[pid].lastTs = Math.max(agg[pid].lastTs, ts);
                  });
                });
                // 依時間由新到舊排序，並覆蓋到recentExecutions
                merged.sort((a, b) => b.timestamp - a.timestamp);
                dispatch(setRecentExecutions(merged as any));

                // 同步聚合計數給觸發統計
                Object.entries(agg).forEach(([pairId, v]) => {
                  dispatch(updatePairTriggerStats({
                    pairId,
                    totalTriggers: v.total,
                    lastTriggered: v.lastTs || null
                  }));
                });
              } catch (error) {
                console.error('刷新執行記錄失敗:', error);
              }
            }}>刷新</Button>
            <Button size="small" danger onClick={() => dispatch(clearExecutionHistory())}>清空</Button>
          </Space>
        }
        className="card-shadow"
      >
        <Table
          size="small"
          rowKey={(r: any) => r?.pairId || String(r?.timestamp) }
          dataSource={
            (monitoringPairs && monitoringPairs.length > 0)
              ? (monitoringPairs || []).map((p: any) => ({
                  pairId: p.id,
                  timestamp: p.lastTriggered || null,
                  leg1Symbol: p?.leg1?.symbol || '-',
                  leg2Symbol: p?.leg2?.symbol || '-',
                  leg1Exchange: p?.leg1?.exchange || '-',
                  leg2Exchange: p?.leg2?.exchange || '-',
                  leg1Type: p?.leg1?.type || 'spot',
                  leg2Type: p?.leg2?.type || 'spot',
                  leg1Side: p?.leg1?.side || 'buy',
                  leg2Side: p?.leg2?.side || 'sell',
                  qty: (Number.isFinite(Number(p?.qty)) ? Number(p?.qty) : (Number.isFinite(Number(p?.amount)) ? Number(p?.amount) : '-')),
                  totalTriggers: p?.totalTriggers ?? 0,
                  maxExecs: p?.maxExecs,
                  enabled: p?.enabled !== false,
                  completed: (typeof p?.maxExecs === 'number') && (p?.totalTriggers >= p?.maxExecs)
                }))
              : (() => {
                  // 後備：若監控清單為空，從最近執行記錄聚合每個 pair 的統計
                  const agg: Record<string, any> = {};
                  (recentExecutions || []).forEach((r: any) => {
                    const pid = r?.opportunity?.id;
                    if (!pid) return;
                    const dir = String(r?.opportunity?.direction || '').toLowerCase();
                    const dirL1Sell = dir === 'leg1_sell_leg2_buy';
                    const derivedLeg1Side = dirL1Sell ? 'sell' : 'buy';
                    const derivedLeg2Side = dirL1Sell ? 'buy' : 'sell';
                    if (!agg[pid]) {
                      agg[pid] = {
                        pairId: pid,
                        timestamp: r?.timestamp || null,
                        leg1Symbol: r?.opportunity?.leg1Price?.symbol || '-',
                        leg2Symbol: r?.opportunity?.leg2Price?.symbol || '-',
                        leg1Exchange: r?.opportunity?.pairConfig?.leg1?.exchange || r?.opportunity?.leg1Price?.exchange || '-',
                        leg2Exchange: r?.opportunity?.pairConfig?.leg2?.exchange || r?.opportunity?.leg2Price?.exchange || '-',
                        leg1Type: r?.opportunity?.pairConfig?.leg1?.type || 'spot',
                        leg2Type: r?.opportunity?.pairConfig?.leg2?.type || 'spot',
                        leg1Side: String(r?.opportunity?.pairConfig?.leg1?.side || derivedLeg1Side).toLowerCase(),
                        leg2Side: String(r?.opportunity?.pairConfig?.leg2?.side || derivedLeg2Side).toLowerCase(),
                        qty: (Number.isFinite(Number(r?.opportunity?.pairConfig?.qty)) ? Number(r?.opportunity?.pairConfig?.qty) : (Number.isFinite(Number(r?.amount)) ? Number(r?.amount) : '-')),
                        totalTriggers: 0,
                        maxExecs: undefined,
                        enabled: false,
                        completed: false
                      };
                    }
                    agg[pid].totalTriggers += (r?.success ? 1 : 0);
                    agg[pid].timestamp = Math.max(agg[pid].timestamp || 0, r?.timestamp || 0);
                    if ((agg[pid].qty === '-' || agg[pid].qty === undefined) && (r?.opportunity?.pairConfig?.qty || r?.amount)) {
                      const v = Number.isFinite(Number(r?.opportunity?.pairConfig?.qty)) ? Number(r?.opportunity?.pairConfig?.qty) : Number(r?.amount);
                      if (Number.isFinite(v)) agg[pid].qty = v;
                    }
                  });
                  Object.values(agg).forEach((row: any) => {
                    row.maxExecs = row.totalTriggers;
                    row.completed = true;
                  });
                  return Object.values(agg);
                })()
          }
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暫無執行記錄' }}
          columns={[
            {
              title: '時間',
              dataIndex: 'timestamp',
              render: (ts: number) => ts ? new Date(ts).toLocaleString() : '-',
              width: 180
            },
            {
              title: '交易對',
              key: 'pair',
              render: (_: any, r: any) => {
                const leg1Sym = r?.leg1Symbol || '-';
                const leg2Sym = r?.leg2Symbol || '-';
                const leg1Ex = r?.leg1Exchange || '-';
                const leg2Ex = r?.leg2Exchange || '-';
                const leg1Type = r?.leg1Type || 'spot';
                const leg2Type = r?.leg2Type || 'spot';
                const leg1Side = r?.leg1Side || 'buy';
                const leg2Side = r?.leg2Side || 'sell';
                const colorFor = (side: string) => (side === 'buy' ? '#52c41a' : '#ff4d4f');
                const typeLabel = (t: string) => (String(t || '').toLowerCase() === 'linear' || String(t || '').toLowerCase() === 'future') ? 'perp' : 'spot';
                return (
                  <div style={{ display: 'flex', gap: 24 }}>
                    <Space size={4}>
                      <Tag color="blue">Leg1</Tag>
                      <Tag>{typeLabel(leg1Type)}</Tag>
                      <Text>{leg1Ex}</Text>
                      <Text strong>{leg1Sym}</Text>
                      <Text style={{ color: colorFor(leg1Side) }}>{leg1Side === 'buy' ? '買' : '賣'}</Text>
                    </Space>
                    <Space size={4}>
                      <Tag color="purple">Leg2</Tag>
                      <Tag>{typeLabel(leg2Type)}</Tag>
                      <Text>{leg2Ex}</Text>
                      <Text strong>{leg2Sym}</Text>
                      <Text style={{ color: colorFor(leg2Side) }}>{leg2Side === 'buy' ? '買' : '賣'}</Text>
                    </Space>
                  </div>
                );
              }
            },
            {
              title: '數量',
              key: 'qty',
              render: (_: any, r: any) => {
                return (typeof r?.qty === 'number') ? r.qty : (r?.qty || '-');
              }
            },
            {
              title: '進度',
              key: 'progress',
              render: (_: any, r: any) => {
                const done = typeof r?.totalTriggers === 'number' ? r.totalTriggers : 0;
                const total = typeof r?.maxExecs === 'number' ? r.maxExecs : undefined;
                return total ? `${Math.min(done, total)}/${total}` : `${done}`;
              }
            },
            {
              title: '狀態',
              key: 'status',
              render: (_: any, r: any) => {
                const status = (r?.status || '').toLowerCase();
                const isCompleted = !!r?.completed || (typeof r?.maxExecs === 'number' && r?.totalTriggers >= r?.maxExecs);
                if (status === 'failed') return <Tag color="error">失敗</Tag>;
                if (status === 'cancelled') return <Tag color="default">已取消</Tag>;
                if (status === 'rolling_back') return <Tag color="orange">回滾中</Tag>;
                if (status === 'rolled_back') return <Tag color="warning">已回滾</Tag>;
                if (isCompleted) return <Tag color="success">完成</Tag>;
                return <Tag color={r?.enabled ? 'processing' : 'default'}>{r?.enabled ? '監控中' : '已停用'}</Tag>;
              }
            },
            {
              title: 'ID',
              key: 'id',
              render: (_: any, r: any) => r?.pairId || '-',
              width: 220
            }
          ]}
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
            threshold: 0.0,
            amount: 100.0, // 舊參數保留
            qty: 0.01,
            totalAmount: 1000,
            executionMode: 'threshold',
            // 預設：Bybit BTCUSDT，Leg1=合約(線性)；Leg2=現貨
            leg1_exchange: 'bybit',
            leg1_type: 'linear',
            leg1_symbol: 'BTCUSDT',
            leg1_side: 'buy',
            leg2_exchange: 'bybit',
            leg2_type: 'spot',
            leg2_symbol: 'BTCUSDT',
            leg2_side: 'sell',
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
                        <span>{exchange.name}</span>
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
                        <span>{exchange.name}</span>
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
                name="orderCount"
                label="執行次數"
                rules={[
                  { required: true, message: '請輸入執行次數' },
                  { type: 'number', min: 1, message: '次數必須至少 1 次' }
                ]}
              >
                <InputNumber
                  min={1}
                  max={1000}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  placeholder="2"
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
                      min={-10}
                      max={10}
                      step={0.01}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="0.10（可填負值如 -0.01）"
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
