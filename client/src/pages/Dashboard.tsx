/**
 * 監控儀表板頁面
 */

import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, Typography, Alert } from 'antd';
import { 
  RiseOutlined, 
  FallOutlined, 
  DollarOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { apiService } from '../services/api';
import logger from '../utils/logger';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { engineStatus, exchanges, isConnected } = useSelector((state: RootState) => state.system);
  const { monitoringPairs, currentOpportunities, recentExecutions } = useSelector((state: RootState) => state.arbitrage);
  const { strategies: twapStrategies } = useSelector((state: RootState) => state.twap);
  
  const [loading, setLoading] = useState(false);
  const [accountData, setAccountData] = useState<any>(null);

  // 載入初始數據
  useEffect(() => {
    loadDashboardData();
    
    // 設置定時刷新
    const interval = setInterval(loadDashboardData, 30000); // 30秒刷新一次
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    if (!isConnected) return;
    
    try {
      setLoading(true);
      
      // 載入賬戶信息
      const accountInfo = await apiService.getAccount('bybit');
      setAccountData(accountInfo.data);
      
    } catch (error) {
      logger.error('載入儀表板數據失敗', error, 'Dashboard');
    } finally {
      setLoading(false);
    }
  };

  // 統計數據
  const stats = {
    activePairs: monitoringPairs.filter(p => p.enabled).length,
    totalOpportunities: currentOpportunities.length,
    triggerableOpportunities: currentOpportunities.filter(o => o.shouldTrigger).length,
    activeTwapStrategies: twapStrategies.filter(s => s.status === 'active').length,
    todayProfit: engineStatus.stats.todayProfit,
    successRate: engineStatus.stats.totalTrades > 0 
      ? (engineStatus.stats.successfulTrades / engineStatus.stats.totalTrades * 100).toFixed(1)
      : '0',
  };

  // 機會列表表格列定義
  const opportunityColumns = [
    {
      title: '交易對',
      key: 'pair',
      render: (record: any) => {
        if (!record.pairConfig?.leg1) {
          return <Text type="secondary">數據載入中...</Text>;
        }
        return (
          <Space direction="vertical" size="small">
            <Text strong>{record.pairConfig.leg1.symbol || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.pairConfig.leg1.exchange} {record.pairConfig.leg1.type}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '對手',
      key: 'counterpart',
      render: (record: any) => {
        if (!record.pairConfig?.leg2) {
          return <Text type="secondary">數據載入中...</Text>;
        }
        return (
          <Space direction="vertical" size="small">
            <Text strong>{record.pairConfig.leg2.symbol || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.pairConfig.leg2.exchange} {record.pairConfig.leg2.type}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '價差',
      key: 'spread',
      render: (record: any) => (
        <Space direction="vertical" size="small">
          <Text className={record.spread > 0 ? 'price-positive' : 'price-negative'}>
            {record.spread ? record.spread.toFixed(6) : '-'}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.spreadPercent ? record.spreadPercent.toFixed(3) : '-'}%
          </Text>
        </Space>
      ),
    },
    {
      title: '閾值',
      dataIndex: 'threshold',
      key: 'threshold',
      render: (threshold: number) => `${threshold}%`,
    },
    {
      title: '狀態',
      key: 'status',
      render: (record: any) => (
        <Tag color={record.shouldTrigger ? 'success' : 'default'}>
          {record.shouldTrigger ? '可觸發' : '監控中'}
        </Tag>
      ),
    },
    {
      title: '更新時間',
      key: 'timestamp',
      render: (record: any) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {new Date(record.timestamp).toLocaleTimeString()}
        </Text>
      ),
    },
  ];

  // 最近執行表格列定義
  const executionColumns = [
    {
      title: '時間',
      key: 'timestamp',
      render: (record: any) => (
        <Text style={{ fontSize: '12px' }}>
          {new Date(record.timestamp).toLocaleString()}
        </Text>
      ),
    },
    {
      title: '交易對',
      key: 'pair',
      render: (record: any) => (
        <Text>
          {record.opportunity.pairConfig.leg1.symbol} - {record.opportunity.pairConfig.leg2.symbol}
        </Text>
      ),
    },
    {
      title: '價差',
      key: 'spread',
      render: (record: any) => (
        <Text className={record.opportunity.spread > 0 ? 'price-positive' : 'price-negative'}>
          {record.opportunity.spreadPercent ? record.opportunity.spreadPercent.toFixed(3) : '-'}%
        </Text>
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
            📊 監控儀表板
          </Title>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadDashboardData}
            loading={loading}
          >
            刷新數據
          </Button>
        </Space>
      </div>

      {/* 連接狀態提示 */}
      {!isConnected && (
        <Alert
          message="系統未連接"
          description="請檢查網路連接或服務器狀態"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 統計卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="活躍監控對"
              value={stats.activePairs}
              prefix={<SwapOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="套利機會"
              value={stats.triggerableOpportunities}
              suffix={`/ ${stats.totalOpportunities}`}
              prefix={<RiseOutlined />}
              valueStyle={{ color: stats.triggerableOpportunities > 0 ? '#52c41a' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="TWAP策略"
              value={stats.activeTwapStrategies}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="今日收益"
              value={stats.todayProfit}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ 
                color: stats.todayProfit > 0 ? '#52c41a' : 
                       stats.todayProfit < 0 ? '#ff4d4f' : '#8c8c8c' 
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主要內容區域 */}
      <Row gutter={[16, 16]}>
        {/* 當前套利機會 */}
        <Col xs={24} xl={14}>
          <Card 
            title="📈 當前套利機會" 
            extra={
              <Tag color={stats.triggerableOpportunities > 0 ? 'success' : 'default'}>
                {stats.triggerableOpportunities} 個可觸發
              </Tag>
            }
            className="card-shadow"
          >
            <Table
              columns={opportunityColumns}
              dataSource={currentOpportunities}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>

        {/* 系統狀態 */}
        <Col xs={24} xl={10}>
          <Card title="🔧 系統狀態" className="card-shadow">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 引擎狀態 */}
              <div>
                <Text strong>套利引擎：</Text>
                <Tag color={engineStatus.isRunning ? 'success' : 'error'}>
                  {engineStatus.isRunning ? '運行中' : '已停止'}
                </Tag>
              </div>

              {/* 交易所連接 */}
              <div>
                <Text strong>交易所連接：</Text>
                <div style={{ marginTop: 8 }}>
                  {Object.entries(exchanges).map(([key, exchange]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{exchange.name}</Text>
                      <Tag color={exchange.connected ? 'success' : 'error'}>
                        {exchange.connected ? '已連接' : '未連接'}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>

              {/* 成功率 */}
              <div>
                <Text strong>成功率：</Text>
                <Text style={{ marginLeft: 8, fontSize: '16px', fontWeight: 600 }}>
                  {stats.successRate}%
                </Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({engineStatus.stats.successfulTrades}/{engineStatus.stats.totalTrades})
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 最近執行記錄 */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="📋 最近執行記錄" className="card-shadow">
            <Table
              columns={executionColumns}
              dataSource={recentExecutions.slice(0, 10)}
              rowKey={(record) => `${record.timestamp}_${record.opportunity.id}`}
              size="small"
              pagination={false}
              locale={{ emptyText: '暫無執行記錄' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
