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
import { apiService, TwapStrategyConfig, ApiResponse } from '../services/api';
import { addStrategy, removeStrategy, pauseStrategy, resumeStrategy, cancelStrategy } from '../store/slices/twapSlice';
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
        response.data.forEach((strategy: any) => {
          dispatch(addStrategy(strategy));
        });
      }
    } catch (error) {
      logger.error('載入TWAP策略失敗', error, 'TwapPage');
    }
  }, [dispatch]);

  // 載入TWAP策略
  useEffect(() => {
    loadTwapStrategies();
  }, [loadTwapStrategies]);

  // 添加/更新TWAP策略
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 生成唯一 ID（如果沒有編輯中的策略）
      const strategyId = editingStrategy?.id || `twap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const config: TwapStrategyConfig = {
        id: strategyId,
        leg1: {
          exchange: values.leg1_exchange,
          symbol: values.leg1_symbol,
          type: values.leg1_type,
          side: values.leg1_side,
        },
        leg2: {
          exchange: values.leg2_exchange,
          symbol: values.leg2_symbol,
          type: values.leg2_type,
          side: values.leg2_side,
        },
        totalAmount: values.totalAmount,
        timeInterval: values.timeInterval * 1000, // 轉換為毫秒
        orderCount: values.orderCount,
        priceType: values.priceType || 'market',
        enabled: values.enabled ?? true,
      };

      let response: ApiResponse;
      if (editingStrategy) {
        // 更新時不傳遞 ID，只傳遞更新數據
        const updateData = { ...config };
        delete updateData.id; // 移除 ID，避免傳遞到更新請求中
        response = await apiService.updateTwapStrategy(editingStrategy.id, updateData) as unknown as ApiResponse;
      } else {
        response = await apiService.addTwapStrategy(config) as unknown as ApiResponse;
      }

      if (response.success) {
        dispatch(addStrategy(response.data));
        message.success(editingStrategy ? '更新成功' : '添加成功');
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

  // 暫停/恢復策略
  const handleTogglePause = async (strategy: any) => {
    try {
      if (strategy.status === 'active') {
        dispatch(pauseStrategy(strategy.id));
        message.success('策略已暫停');
      } else if (strategy.status === 'paused') {
        dispatch(resumeStrategy(strategy.id));
        message.success('策略已恢復');
      }
    } catch (error: any) {
      message.error(error.message || '操作失敗');
    }
  };

  // 取消策略
  const handleCancel = (id: string) => {
    confirm({
      title: '確認取消',
      content: '確定要取消這個TWAP策略嗎？取消後無法恢復。',
      icon: <ExclamationCircleOutlined />,
      onOk: () => {
        dispatch(cancelStrategy(id));
        message.success('策略已取消');
      },
    });
  };

  // 編輯策略
  const handleEdit = (strategy: any) => {
    setEditingStrategy(strategy);
    form.setFieldsValue({
      leg1_exchange: strategy.leg1.exchange,
      leg1_symbol: strategy.leg1.symbol,
      leg1_type: strategy.leg1.type,
      leg1_side: strategy.leg1.side,
      leg2_exchange: strategy.leg2.exchange,
      leg2_symbol: strategy.leg2.symbol,
      leg2_type: strategy.leg2.type,
      leg2_side: strategy.leg2.side,
      totalAmount: strategy.totalAmount,
      timeInterval: strategy.timeInterval / 1000, // 轉換為秒
      orderCount: strategy.orderCount,
      priceType: strategy.priceType,
      enabled: strategy.enabled,
    });
    setIsModalVisible(true);
  };

  // 計算進度百分比
  const getProgress = (strategy: any) => {
    return strategy.orderCount > 0 ? (strategy.executedOrders / strategy.orderCount) * 100 : 0;
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
              {exchanges[record.leg1.exchange]?.name} {record.leg1.type}
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
              {exchanges[record.leg2.exchange]?.name} {record.leg2.type}
            </Text>
            <Tag color={record.leg2.side === 'buy' ? 'green' : 'red'}>
              {record.leg2.side === 'buy' ? '賣出' : '買入'}
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
              {record.executedOrders}/{record.orderCount} 筆
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
        return formatAmountWithCurrency(record.remainingAmount, symbol);
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
          {record.status === 'active' && (
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
          
          {(record.status === 'active' || record.status === 'paused') && (
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
      render: () => (
        <Tag color="blue">雙腿執行</Tag>
      ),
    },
    {
      title: '數量',
      key: 'amount',
      render: (record: any) => {
        // 從策略中獲取交易對符號
        const strategy = strategies.find(s => s.id === record.strategyId);
        const symbol = strategy?.leg1?.symbol || 'BTCUSDT';
        return formatAmountWithCurrency(record.amount, symbol);
      },
    },
    {
      title: '執行價格',
      key: 'prices',
      render: (record: any) => (
        <Space direction="vertical" size="small">
          <Text style={{ fontSize: '12px' }}>
            Leg1: {record.leg1Price ? record.leg1Price.toFixed(6) : '市價'}
          </Text>
          <Text style={{ fontSize: '12px' }}>
            Leg2: {record.leg2Price ? record.leg2Price.toFixed(6) : '市價'}
          </Text>
        </Space>
      ),
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

      {/* 使用說明 */}
      <Card style={{ marginBottom: 24 }} className="card-shadow">
        <Alert
          message="TWAP策略說明"
          description={
            <div>
              <p>• <strong>雙腿TWAP策略</strong>：同時在兩個交易對執行時間加權平均價格策略，實現套利或對沖</p>
              <p>• <strong>雙腿配置</strong>：可以自由選擇兩個不同的交易所、交易對和方向組合</p>
              <p>• <strong>智能執行</strong>：系統會同步執行兩個腿的分割訂單，保持策略一致性</p>
              <p>• <strong>進度監控</strong>：即時查看雙腿執行進度，支持暫停、恢復和取消操作</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Card>

      {/* TWAP策略列表 */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="📋 TWAP策略列表" className="card-shadow">
            <Table
              columns={strategyColumns}
              dataSource={strategies}
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
              dataSource={executions.slice(0, 50)}
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
            leg2_exchange: 'bybit',
            leg2_type: 'future',
            leg2_side: 'sell',
            priceType: 'market',
            enabled: true,
            timeInterval: 60,
            orderCount: 10,
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
                  rules={[{ required: true, message: '請選擇交易對' }]}
                >
                  <Select 
                    placeholder="選擇交易對"
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
                  rules={[{ required: true, message: '請選擇交易對' }]}
                >
                  <Select 
                    placeholder="選擇交易對"
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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priceType"
                label="訂單類型"
                rules={[{ required: true, message: '請選擇訂單類型' }]}
              >
                <Select placeholder="選擇類型">
                  <Option value="market">市價單</Option>
                  <Option value="limit">限價單</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="totalAmount"
                label="總交易數量"
                rules={[{ required: true, message: '請輸入總交易數量' }]}
                extra="每次觸發時的下單數量"
              >
                <InputNumber
                  min={0.01}
                  step={0.01}
                  style={{ width: '100%' }}
                  placeholder="1"
                  addonAfter="幣"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="orderCount"
                label="分割訂單數"
                rules={[{ required: true, message: '請輸入分割訂單數' }]}
              >
                <InputNumber
                  min={1}
                  max={100}
                  step={1}
                  style={{ width: '100%' }}
                  placeholder="10"
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
                  placeholder="60"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="enabled"
                label="立即啟用"
                valuePropName="checked"
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
