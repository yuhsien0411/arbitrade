/**
 * TWAP策略頁面
 * 用戶自定義標的、數量、時間間隔
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Row, Col, Card, Form, Select, InputNumber, Button, Table, Space, 
  Typography, Tag, Switch, Modal, Progress, Alert, Tooltip, Divider, App as AntdApp
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined,
  SettingOutlined, ReloadOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { apiService, ApiResponse } from '../services/api';
import { addStrategy, updateStrategy, removeStrategy, setStrategies, pauseStrategy, resumeStrategy, cancelStrategy } from '../store/slices/twapSlice';
import { formatAmountWithCurrency } from '../utils/formatters';
import logger from '../utils/logger';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const TwapPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = AntdApp.useApp();
  const { exchanges, isConnected } = useSelector((state: RootState) => state.system);
  const { strategies, executions } = useSelector((state: RootState) => state.twap);
  
  // 將已完成的策略轉換為執行記錄格式
  const completedStrategiesAsExecutions = strategies
    .filter(strategy => strategy.status === 'completed')
    .map(strategy => ({
      strategyId: strategy.id,
      timestamp: strategy.createdAt,
      amount: strategy.totalAmount,
      leg1Price: null,
      leg2Price: null,
      success: true,
      orderId: `completed_${strategy.id}`,
      legIndex: 0
    }));
  
  // 合併原始執行記錄和已完成的策略
  const allExecutions = [...executions, ...completedStrategiesAsExecutions]
    .sort((a, b) => b.timestamp - a.timestamp);
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<any>(null);

  // 可用的交易所
  const availableExchanges = Object.entries(exchanges)
    .filter(([_, exchange]) => exchange.connected)
    .map(([key, exchange]) => ({ key, name: exchange.name, symbols: exchange.symbols }));

  const loadTwapStrategies = useCallback(async () => {
    try {
      const response = await apiService.getTwapStrategies() as unknown as ApiResponse;
      if (response.success && response.data) {
        // 轉換後端數據為前端格式
        const strategies = response.data.map((plan: any) => ({
          id: plan.planId,
          leg1: {
            exchange: plan.legs?.[0]?.exchange || 'bybit',
            symbol: plan.legs?.[0]?.symbol || 'BTCUSDT',
            type: 'spot' as const, // 第一個 leg 總是現貨
            side: plan.legs?.[0]?.side || 'buy'
          },
          leg2: {
            exchange: plan.legs?.[1]?.exchange || 'bybit',
            symbol: plan.legs?.[1]?.symbol || 'BTCUSDT',
            type: 'future' as const, // 第二個 leg 總是永續合約
            side: plan.legs?.[1]?.side || 'sell'
          },
          totalAmount: plan.totalQty,
          timeInterval: plan.intervalMs,
          orderCount: plan.slicesTotal,
          amountPerOrder: plan.sliceQty,
          priceType: 'market' as const,
          enabled: true,
          createdAt: plan.createdAt || Date.now(),
          executedOrders: plan.progress?.slicesDone || 0,
          remainingAmount: Math.max(0, plan.progress?.remaining || plan.totalQty),
          nextExecutionTime: plan.progress?.nextExecutionTs || 0,
          status: plan.state === 'running' ? 'active' as const : 
                 plan.state === 'paused' ? 'paused' as const :
                 plan.state === 'completed' ? 'completed' as const :
                 plan.state === 'cancelled' ? 'cancelled' as const : 'active' as const
        }));
        
        // 一次性設置所有策略
        dispatch(setStrategies(strategies));
      }
    } catch (error) {
      logger.error('載入TWAP策略失敗', error, 'TwapPage');
    }
  }, [dispatch]);

  // 載入TWAP策略
  useEffect(() => {
    loadTwapStrategies();
  }, [loadTwapStrategies]);

  // 添加/更新TWAP策略（後端僅需單腿：symbol/side/totalAmount/timeInterval/orderCount）
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 構建符合後端 API 格式的請求數據
      const payload = {
        name: `TWAP策略_${Date.now()}`,
        totalQty: values.sliceQty * values.orderCount, // 總數量 = 單次數量 × 執行次數
        sliceQty: values.sliceQty, // 單次數量
        intervalMs: Math.max((values.timeInterval || 10), 10) * 1000,
        legs: [
          {
            exchange: values.leg1_exchange || "bybit",
            symbol: values.leg1_symbol,
            side: values.leg1_side,
            type: "market"  // 現貨交易
          },
          {
            exchange: values.leg2_exchange || "bybit",
            symbol: values.leg2_symbol,
            side: values.leg2_side,
            type: "market"  // 合約交易
          }
        ]
      };

      let response: ApiResponse;
      if (editingStrategy) {
        // 更新現有策略
        response = await apiService.updateTwapStrategy(editingStrategy.id, payload) as unknown as ApiResponse;
      } else {
        // 創建新策略
        response = await apiService.addTwapStrategy(payload) as unknown as ApiResponse;
      }

      if (response.success) {
        // 構建完整的策略對象
        const strategyData = {
          id: editingStrategy ? editingStrategy.id : response.data.planId,
          leg1: {
            exchange: payload.legs[0].exchange,
            symbol: payload.legs[0].symbol,
            type: payload.legs[0].type as 'spot' | 'future',
            side: payload.legs[0].side as 'buy' | 'sell'
          },
          leg2: {
            exchange: payload.legs[1].exchange,
            symbol: payload.legs[1].symbol,
            type: 'future' as const,
            side: payload.legs[1].side as 'buy' | 'sell'
          },
          totalAmount: payload.totalQty,
          timeInterval: payload.intervalMs,
          orderCount: Math.round(payload.totalQty / payload.sliceQty),
          amountPerOrder: payload.sliceQty,
          priceType: 'market' as const,
          enabled: true,
          createdAt: editingStrategy ? editingStrategy.createdAt : Date.now(),
          executedOrders: editingStrategy ? editingStrategy.executedOrders : 0,
          remainingAmount: Math.max(0, payload.totalQty),
          nextExecutionTime: 0,
          status: editingStrategy ? editingStrategy.status : 'active' as const
        };
        
        if (editingStrategy) {
          // 更新現有策略
          dispatch(updateStrategy({ id: editingStrategy.id, updates: strategyData }));
        } else {
          // 添加新策略
          dispatch(addStrategy(strategyData));
          
          // 如果啟用了自動執行，則自動啟動策略
          if (values.enabled && response.data.planId) {
            try {
              const startResponse = await apiService.controlTwapStrategy(response.data.planId, 'start') as unknown as ApiResponse;
              if (startResponse.success) {
                dispatch(resumeStrategy(response.data.planId));
                message.success('策略已創建並自動啟動');
              } else {
                message.success('策略創建成功，請手動啟動');
              }
            } catch (error) {
              message.success('策略創建成功，請手動啟動');
            }
          } else {
            message.success('策略創建成功，請手動啟動');
          }
        }
        
        if (editingStrategy) {
          message.success('更新成功');
        }
        
        setIsModalVisible(false);
        form.resetFields();
        setEditingStrategy(null);
      }
    } catch (error: any) {
      message.error(error.message || '操作失敗');
    } finally {
      setLoading(false);
    }
  };

  // 刪除TWAP策略
  const handleDelete = (id: string) => {
    confirm({
      title: '確認刪除',
      content: '確定要刪除這個TWAP策略嗎？',
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        try {
          await apiService.removeTwapStrategy(id);
          dispatch(removeStrategy(id));
          message.success('刪除成功');
        } catch (error: any) {
          message.error(error.message || '刪除失敗');
        }
      },
    });
  };

  // 啟動策略
  const handleStart = async (strategy: any) => {
    try {
      const response = await apiService.controlTwapStrategy(strategy.id, 'start') as unknown as ApiResponse;
      
      if (response.success) {
        dispatch(resumeStrategy(strategy.id)); // 使用 resume 來更新狀態為 running
        message.success('策略已啟動');
      } else {
        message.error(response.message || '啟動失敗');
      }
    } catch (error: any) {
      message.error(error.message || '啟動失敗');
    }
  };

  // 暫停/恢復策略
  const handleTogglePause = async (strategy: any) => {
    try {
      const action = strategy.status === 'running' ? 'pause' : 'resume';
      const response = await apiService.controlTwapStrategy(strategy.id, action) as unknown as ApiResponse;
      
      if (response.success) {
        if (strategy.status === 'running') {
          dispatch(pauseStrategy(strategy.id));
          message.success('策略已暫停');
        } else if (strategy.status === 'paused') {
          dispatch(resumeStrategy(strategy.id));
          message.success('策略已恢復');
        }
      } else {
        const errorMsg = response.message || '操作失敗';
        message.error(errorMsg);
        console.error('TWAP control error:', response);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail?.message || error.message || '操作失敗';
      message.error(errorMsg);
      console.error('TWAP control exception:', error);
    }
  };

  // 取消策略
  const handleCancel = (id: string) => {
    confirm({
      title: '確認取消',
      content: '確定要取消這個TWAP策略嗎？取消後無法恢復。',
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        try {
          const response = await apiService.controlTwapStrategy(id, 'cancel') as unknown as ApiResponse;
          if (response.success) {
            dispatch(cancelStrategy(id));
            message.success('策略已取消');
          } else {
            message.error(response.message || '取消失敗');
          }
        } catch (error: any) {
          message.error(error.message || '取消失敗');
        }
      },
    });
  };

  // 編輯策略
  const handleEdit = (strategy: any) => {
    setEditingStrategy(strategy);
    const leg1Exchange = strategy?.leg1?.exchange || 'bybit';
    const leg1Symbol = strategy?.leg1?.symbol || strategy?.symbol || 'BTCUSDT';
    const leg1Type = strategy?.leg1?.type || 'future';
    const leg1Side = strategy?.leg1?.side || strategy?.side || 'buy';
    const leg2Exchange = strategy?.leg2?.exchange || 'bybit';
    const leg2Symbol = strategy?.leg2?.symbol || leg1Symbol;
    const leg2Type = strategy?.leg2?.type || 'future';
    const leg2Side = strategy?.leg2?.side || 'sell';
    const timeIntervalSec = Math.max(1, Math.round(((strategy?.timeInterval ?? 1000) as number) / 1000));

    form.setFieldsValue({
      leg1_exchange: leg1Exchange,
      leg1_symbol: leg1Symbol,
      leg1_type: leg1Type,
      leg1_side: leg1Side,
      leg2_exchange: leg2Exchange,
      leg2_symbol: leg2Symbol,
      leg2_type: leg2Type,
      leg2_side: leg2Side,
      sliceQty: strategy.sliceQty || (strategy.totalAmount / strategy.orderCount), // 單次數量
      timeInterval: timeIntervalSec,
      orderCount: strategy.orderCount,
      enabled: strategy.enabled ?? true,
    });
    setIsModalVisible(true);
  };

  // 計算進度百分比
  const getProgress = (strategy: any) => {
    if (strategy.status === 'completed') {
      return 100;
    }
    // 計算已完成的執行次數（每次執行包含兩個腿）
    const completedExecutions = Math.floor((strategy.executedOrders || 0) / 2);
    return strategy.orderCount > 0 ? (completedExecutions / strategy.orderCount) * 100 : 0;
  };

  // 格式化時間間隔
  const formatTimeInterval = (milliseconds: number) => {
    const seconds = milliseconds / 1000;
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分鐘`;
    return `${Math.floor(seconds / 3600)}小時`;
  };

  // 策略表格列定義
  const strategyColumns = [
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
              {exchanges[record.leg1.exchange]?.name} {record.leg1.type === 'future' ? 'PERP' : 'SPOT'}
            </Text>
            <Tag color={record.leg1.side === 'buy' ? 'green' : 'red'}>
              {record.leg1.side === 'buy' ? '買入' : '賣出'}
            </Tag>
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
              {exchanges[record.leg2.exchange]?.name} {record.leg2.type === 'future' ? 'PERP' : 'SPOT'}
            </Text>
            <Tag color={record.leg2.side === 'buy' ? 'green' : 'red'}>
              {record.leg2.side === 'buy' ? '買入' : '賣出'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '總數量',
      key: 'totalAmount',
      render: (record: any) => {
        // 使用 leg1 的交易對符號來確定幣種
        const symbol = record.leg1?.symbol || record.leg2?.symbol || 'BTCUSDT';
        return formatAmountWithCurrency(record.totalAmount, symbol);
      },
    },
    {
      title: '執行進度',
      key: 'progress',
      render: (record: any) => {
        const progress = getProgress(record);
        return (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Progress 
              percent={progress} 
              size="small" 
              status={record.status === 'completed' ? 'success' : 'active'}
            />
            <Text style={{ fontSize: '12px' }}>
              {Math.floor((record.executedOrders || 0) / 2)}/{record.orderCount} 次
            </Text>
          </Space>
        );
      },
    },
    {
      title: '時間間隔',
      key: 'timeInterval',
      render: (record: any) => formatTimeInterval(record.timeInterval),
    },
    {
      title: '剩餘數量',
      key: 'remainingAmount',
      render: (record: any) => {
        // 使用 leg1 的交易對符號來確定幣種
        const symbol = record.leg1?.symbol || record.leg2?.symbol || 'BTCUSDT';
        // 確保剩餘數量不會顯示負數
        const remainingAmount = Math.max(0, record.remainingAmount || 0);
        return formatAmountWithCurrency(remainingAmount, symbol);
      },
    },
    {
      title: '狀態',
      key: 'status',
      render: (record: any) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          active: { color: 'processing', text: '執行中' },
          paused: { color: 'warning', text: '已暫停' },
          completed: { color: 'success', text: '已完成' },
          cancelled: { color: 'error', text: '已取消' },
        };
        
        const status = statusMap[record.status] || { color: 'default', text: '未知' };
        
        return (
          <Space direction="vertical" size="small">
            <Tag color={status.color}>{status.text}</Tag>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.nextExecutionTime && record.status === 'active' 
                ? `下次: ${new Date(record.nextExecutionTime).toLocaleTimeString()}`
                : ''
              }
            </Text>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: any) => (
        <Space>
          {record.status === 'pending' && (
            <Tooltip title="啟動">
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStart(record)}
              />
            </Tooltip>
          )}
          
          {(record.status === 'running' || record.status === 'active') && (
            <Tooltip title="暫停">
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleTogglePause(record)}
              />
            </Tooltip>
          )}
          
          {record.status === 'paused' && (
            <Tooltip title="恢復">
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleTogglePause(record)}
              />
            </Tooltip>
          )}
          
          {(record.status === 'running' || record.status === 'paused' || record.status === 'active') && (
            <Tooltip title="取消">
              <Button
                size="small"
                danger
                icon={<ExclamationCircleOutlined />}
                onClick={() => handleCancel(record.id)}
              />
            </Tooltip>
          )}
          
          <Tooltip title="編輯">
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.status === 'completed' || record.status === 'cancelled'}
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
      ),
    },
  ];

  // 執行記錄表格列定義
  const executionColumns = [
    {
      title: '時間',
      key: 'timestamp',
      render: (record: any) => new Date(record.timestamp).toLocaleString(),
    },
    {
      title: '策略ID',
      dataIndex: 'strategyId',
      key: 'strategyId',
      render: (id: string) => id.slice(-8),
    },
    {
      title: '執行類型',
      key: 'type',
      render: (record: any) => {
        const isCompleted = record.orderId?.startsWith('completed_');
        return (
          <Tag color={isCompleted ? 'green' : 'blue'}>
            {isCompleted ? '策略完成' : '雙腿執行'}
          </Tag>
        );
      },
    },
    {
      title: '數量',
      key: 'amount',
      render: (record: any) => {
        // 從策略中獲取交易對符號
        const strategy = strategies.find(s => s.id === record.strategyId);
        const symbol = strategy?.leg1?.symbol || 'BTCUSDT';
        const isCompleted = record.orderId?.startsWith('completed_');
        const amount = isCompleted ? strategy?.totalAmount || record.amount : record.amount;
        return formatAmountWithCurrency(amount, symbol);
      },
    },
    {
      title: '執行價格',
      key: 'prices',
      render: (record: any) => {
        const isCompleted = record.orderId?.startsWith('completed_');
        if (isCompleted) {
          return (
            <Space direction="vertical" size="small">
              <Text style={{ fontSize: '12px', color: '#52c41a' }}>
                Leg1: 現貨市價
              </Text>
              <Text style={{ fontSize: '12px', color: '#52c41a' }}>
                Leg2: 合約市價
              </Text>
            </Space>
          );
        }
        return (
          <Space direction="vertical" size="small">
            <Text style={{ fontSize: '12px' }}>
              Leg1: {record.leg1Price ? record.leg1Price.toFixed(6) : '市價'}
            </Text>
            <Text style={{ fontSize: '12px' }}>
              Leg2: {record.leg2Price ? record.leg2Price.toFixed(6) : '市價'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '狀態',
      key: 'success',
      render: (record: any) => (
        <Tag color={record.success ? 'success' : 'error'}>
          {record.success ? '成功' : '失敗'}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      {/* 頁面標題 */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>
            ⏰ TWAP策略管理
          </Title>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadTwapStrategies}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingStrategy(null);
                form.resetFields();
                setIsModalVisible(true);
              }}
              disabled={!isConnected}
            >
              新建策略
            </Button>
          </Space>
        </Space>
      </div>

      {/* 連接狀態提示 */}
      {!isConnected && (
        <Alert
          message="系統未連接"
          description="請檢查網路連接，無法創建TWAP策略"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

  

      {/* TWAP策略列表 */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="📋 TWAP策略列表" className="card-shadow">
            <Table
              columns={strategyColumns}
              dataSource={strategies.filter(strategy => strategy.status !== 'completed')}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1000 }}
              locale={{ emptyText: '暫無TWAP策略，點擊上方按鈕創建' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 執行記錄 */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="📊 執行記錄" className="card-shadow">
            <Table
              columns={executionColumns}
              dataSource={allExecutions.slice(0, 50)}
              rowKey={(record) => `${record.strategyId}_${record.timestamp}`}
              size="small"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: '暫無執行記錄' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 添加/編輯對話框 */}
      <Modal
        title={editingStrategy ? '編輯TWAP策略' : '新建TWAP策略'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingStrategy(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            leg1_exchange: 'bybit',
            leg1_type: 'future',
            leg1_side: 'buy',
            leg1_symbol: 'BTCUSDT',
            leg2_exchange: 'bybit',
            leg2_type: 'future',
            leg2_side: 'sell',
            leg2_symbol: 'BTCUSDT',
            enabled: true,
            timeInterval: 10,
            orderCount: 2,
            sliceQty: 0.01,
          }}
        >
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
                      <Option key={exchange.key} value={exchange.key}>
                        {exchange.name}
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
                    <Option value="future">合約</Option>
                    <Option value="spot">現貨</Option>
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
                  <Select 
                    placeholder="選擇交易對"
                    defaultValue="BTCUSDT"
                    showSearch
                    filterOption={(input, option) => {
                      if (!option?.children) return false;
                      const children = String(option.children);
                      return children.toLowerCase().includes(input.toLowerCase());
                    }}
                  >
                    <Option value="BTCUSDT">BTCUSDT</Option>
                    <Option value="ETHUSDT">ETHUSDT</Option>
                    <Option value="ADAUSDT">ADAUSDT</Option>
                    <Option value="SOLUSDT">SOLUSDT</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg1_side"
                  label="交易方向"
                  rules={[{ required: true, message: '請選擇交易方向' }]}
                >
                  <Select placeholder="選擇方向">
                    <Option value="buy">買入</Option>
                    <Option value="sell">賣出</Option>
                  </Select>
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
                      <Option key={exchange.key} value={exchange.key}>
                        {exchange.name}
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
                    <Option value="future">合約</Option>
                    <Option value="spot">現貨</Option>
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
                  <Select 
                    placeholder="選擇交易對"
                    defaultValue="BTCUSDT"
                    showSearch
                    filterOption={(input, option) => {
                      if (!option?.children) return false;
                      const children = String(option.children);
                      return children.toLowerCase().includes(input.toLowerCase());
                    }}
                  >
                    <Option value="BTCUSDT">BTCUSDT</Option>
                    <Option value="ETHUSDT">ETHUSDT</Option>
                    <Option value="ADAUSDT">ADAUSDT</Option>
                    <Option value="SOLUSDT">SOLUSDT</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="leg2_side"
                  label="交易方向"
                  rules={[{ required: true, message: '請選擇交易方向' }]}
                >
                  <Select placeholder="選擇方向">
                    <Option value="buy">買入</Option>
                    <Option value="sell">賣出</Option>
                  </Select>
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Divider />

          {/* 僅允許市價單，UI 不提供切換 */}

          {/* 固定使用市價單，不顯示選擇 */}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sliceQty"
                label="單次數量"
                rules={[{ required: true, message: '請輸入單次數量' }]}
                extra="每次執行的下單數量"
              >
                <InputNumber
                  min={0.01}
                  step={0.01}
                  style={{ width: '100%' }}
                  placeholder="0.01"
                  addonAfter="幣"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="orderCount"
                label="執行次數"
                rules={[{ required: true, message: '請輸入執行次數' }]}
                extra="總共執行多少次"
              >
                <InputNumber
                  min={1}
                  max={100}
                  step={1}
                  style={{ width: '100%' }}
                  placeholder="2"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="timeInterval"
                label="執行間隔 (秒)"
                rules={[{ required: true, message: '請輸入執行間隔' }]}
              >
                <InputNumber
                  min={1}
                  max={3600}
                  step={1}
                  style={{ width: '100%' }}
                  placeholder="10"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="enabled"
                label="立即啟用"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingStrategy ? '更新' : '創建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TwapPage;
