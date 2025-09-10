/**
 * 系統設定頁面
 * 風險控制、API設定等
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Row, Col, Card, Form, InputNumber, Button, Space, Typography, 
  Divider, Alert, Switch, Input, Tabs, Modal, Select, List, Tag, Popconfirm, App as AntdApp
} from 'antd';
import { 
  SafetyOutlined, ApiOutlined, SettingOutlined, 
  SaveOutlined, ReloadOutlined, EditOutlined,
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { apiService, RiskSettings, ApiResponse } from '../services/api';
import { updateRiskLimits } from '../store/slices/systemSlice';
import logger from '../utils/logger';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
// TextArea 暫時不使用，已移除

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = AntdApp.useApp();
  const { engineStatus, exchanges } = useSelector((state: RootState) => state.system);
  
  const [riskForm] = Form.useForm();
  const [apiForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  // 編輯模式狀態暫時不使用，已移除
  // const [isEditMode, setIsEditMode] = useState(false);
  
  // API管理相關狀態
  const [isApiModalVisible, setIsApiModalVisible] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<any[]>([]);
  const [editingApi, setEditingApi] = useState<any>(null);
  
  // 支援的交易所列表
  const supportedExchanges = [
    {
      key: 'bybit',
      name: 'Bybit',
      icon: '🟡',
      fields: ['apiKey', 'secret'],
      status: 'active',
      description: '全功能支援，可立即使用'
    },
    {
      key: 'binance',
      name: 'Binance',
      icon: '🟨',
      fields: ['apiKey', 'secret'],
      status: 'coming_soon',
      description: '開發中，敬請期待'
    },
    {
      key: 'okx',
      name: 'OKX',
      icon: '⚫',
      fields: ['apiKey', 'secret', 'passphrase'],
      status: 'coming_soon',
      description: '開發中，支援 Passphrase'
    },
    {
      key: 'bitget',
      name: 'Bitget',
      icon: '🔵',
      fields: ['apiKey', 'secret', 'passphrase'],
      status: 'coming_soon',
      description: '開發中，支援 Passphrase'
    }
  ];

  const loadCurrentSettings = useCallback(async () => {
    try {
      // 載入風險控制設定
      riskForm.setFieldsValue({
        maxPositionSize: engineStatus.riskLimits.maxPositionSize,
        maxDailyLoss: engineStatus.riskLimits.maxDailyLoss,
        priceDeviationThreshold: engineStatus.riskLimits.priceDeviationThreshold * 100, // 轉換為百分比
      });

      // 載入API設定狀態
      const response = await apiService.getApiSettings();
      if (response.data) {
        apiForm.setFieldsValue({
          bybitApiKey: (response.data.bybit && response.data.bybit.apiKey) ? '***已配置***' : '',
          bybitSecret: (response.data.bybit && response.data.bybit.secret) ? '***已配置***' : '',
        });
      }
    } catch (error) {
      logger.error('載入設定失敗', error, 'SettingsPage');
      // 設置默認值
      apiForm.setFieldsValue({
        bybitApiKey: '',
        bybitSecret: '',
      });
    }
  }, [engineStatus.riskLimits, riskForm, apiForm]);

  // 載入當前設定
  useEffect(() => {
    loadCurrentSettings();
    loadApiConfigs();
  }, [loadCurrentSettings]);

  // 保存風險控制設定
  const handleSaveRiskSettings = async (values: any) => {
    try {
      setLoading(true);
      
      const settings: RiskSettings = {
        maxPositionSize: values.maxPositionSize,
        maxDailyLoss: values.maxDailyLoss,
        priceDeviationThreshold: values.priceDeviationThreshold / 100, // 轉換為小數
      };

      const response = await apiService.updateRiskSettings(settings) as unknown as ApiResponse;
      
      if (response.success) {
        dispatch(updateRiskLimits(settings));
        message.success('風險控制設定已保存');
      }
    } catch (error: any) {
      message.error(error.message || '保存失敗');
    } finally {
      setLoading(false);
    }
  };


  // 載入API配置列表
  const loadApiConfigs = async () => {
    try {
      const response = await apiService.getApiSettings();
      logger.info('API Settings Response', response, 'SettingsPage');
      
      if (response.data) {
        const configs = [];
        
        logger.info('API Settings Data', response.data, 'SettingsPage');
        
        // 檢查Bybit配置
        if (response.data.bybit && response.data.bybit.apiKey) {
          logger.info('Adding Bybit config', null, 'SettingsPage');
          configs.push({
            id: 'bybit',
            exchange: 'bybit',
            name: 'Bybit',
            icon: '🟡',
            status: 'configured', // 改為已配置狀態，而不是連接狀態
            connected: false // 默認為未連接，需要測試後才能確認
          });
        }
        
        // 檢查Binance配置
        if (response.data.binance && response.data.binance.apiKey) {
          logger.info('Adding Binance config', null, 'SettingsPage');
          configs.push({
            id: 'binance',
            exchange: 'binance',
            name: 'Binance',
            icon: '🟨',
            status: 'configured',
            connected: false // 暫時設為false，等待實現
          });
        }
        
        // 檢查OKX配置
        if (response.data.okx && response.data.okx.apiKey) {
          logger.info('Adding OKX config', null, 'SettingsPage');
          configs.push({
            id: 'okx',
            exchange: 'okx',
            name: 'OKX',
            icon: '⚫',
            status: 'configured',
            connected: false // 暫時設為false，等待實現
          });
        }
        
        // 檢查Bitget配置
        if (response.data.bitget && response.data.bitget.apiKey) {
          logger.info('Adding Bitget config', null, 'SettingsPage');
          configs.push({
            id: 'bitget',
            exchange: 'bitget',
            name: 'Bitget',
            icon: '🔵',
            status: 'configured',
            connected: false // 暫時設為false，等待實現
          });
        }
        
        logger.info('Final configs', configs, 'SettingsPage');
        setApiConfigs(configs);
      } else {
        logger.info('No API data received, setting empty configs', null, 'SettingsPage');
        setApiConfigs([]);
      }
    } catch (error) {
      logger.error('載入API配置失敗', error, 'SettingsPage');
      setApiConfigs([]); // 確保在錯誤時也清空配置
    }
  };

  // 打開新增API模態框
  const handleAddApi = () => {
    setEditingApi(null);
    apiForm.resetFields();
    setIsApiModalVisible(true);
  };

  // 編輯API配置
  const handleEditApi = async (config: any) => {
    try {
      setLoading(true);
      const response = await apiService.getApiSettingsForEdit();
      if (response.data) {
        setEditingApi(config);
        
        if (config.exchange === 'bybit') {
          apiForm.setFieldsValue({
            exchange: 'bybit',
            apiKey: (response.data.bybit && response.data.bybit.apiKey) || '',
            secret: (response.data.bybit && response.data.bybit.secret) || '',
          });
        }
        
        setIsApiModalVisible(true);
      }
    } catch (error: any) {
      message.error('載入API設定失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  // 刪除API配置
  const handleDeleteApi = async (config: any) => {
    try {
      setLoading(true);
      
      if (config.exchange === 'bybit') {
        // 調用專門的刪除API端點
        const response = await apiService.deleteApiSettings('bybit');
        
        if (response.data) {
          message.success(`已刪除 ${config.name} API配置`);
          
          // 從本地狀態中移除該配置
          setApiConfigs(prevConfigs => 
            prevConfigs.filter(cfg => cfg.exchange !== 'bybit')
          );
        } else {
          message.error('刪除API配置失敗：服務器回應異常');
        }
      } else {
        message.info(`${config.name} 刪除功能開發中，暫時無法使用。`);
      }
      
    } catch (error: any) {
      message.error('刪除API配置失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  // 保存API配置
  const handleSaveApi = async (values: any) => {
    try {
      setLoading(true);
      
      const { exchange, apiKey, secret } = values;
      // passphrase 暫時不使用，為未來的 OKX/Bitget 預留
      const exchangeInfo = supportedExchanges.find(e => e.key === exchange);
      
      if (exchange === 'bybit') {
        await apiService.updateApiSettings({
          bybitApiKey: apiKey,
          bybitSecret: secret,
          bybitTestnet: false
        });
        message.success(`${exchangeInfo?.name} API配置已保存`);
        setIsApiModalVisible(false);
        loadApiConfigs();
      } else {
        // 其他交易所暫時不支援，顯示提示信息
        message.warning(`${exchangeInfo?.name} 功能開發中，暫時無法保存配置。請期待後續版本！`);
        
        // 關閉模態框但不保存
        setIsApiModalVisible(false);
      }
      
    } catch (error: any) {
      message.error('保存API配置失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  // 測試API連接
  const handleTestApiConnection = async (config: any) => {
    try {
      setLoading(true);
      
      if (config.exchange === 'bybit') {
        const response = await apiService.testApiConnection();
        const responseData = response;
        logger.info('API Test Response', responseData, 'SettingsPage');
        
        // 檢查後端實際返回的成功響應格式
        if (responseData && responseData.data && responseData.data.connected) {
          const { accountInfo } = responseData.data;
          
          // 更新本地狀態 - 將連接狀態設為true
          setApiConfigs(prevConfigs => 
            prevConfigs.map(cfg => 
              cfg.exchange === 'bybit' 
                ? { ...cfg, connected: true, status: 'connected' }
                : cfg
            )
          );
          
          if (accountInfo) {
            // 顯示詳細的賬戶信息
            Modal.success({
              title: `${config.name} API測試成功`,
              width: 600,
              content: (
                <div>
                  <p><strong>連接狀態：</strong>✅ 連接成功</p>
                  <p><strong>服務器時間：</strong>{new Date(responseData.data.serverTime * 1000).toLocaleString()}</p>
                  
                  <Divider />
                  <h4>📊 賬戶配置信息</h4>
                  
                  <Row gutter={[16, 8]}>
                    <Col span={12}>
                      <strong>保證金模式：</strong>
                    </Col>
                    <Col span={12}>
                      <Tag color="blue">{accountInfo.marginModeText}</Tag>
                    </Col>
                    
                    <Col span={12}>
                      <strong>賬戶類型：</strong>
                    </Col>
                    <Col span={12}>
                      <Tag color={
                        accountInfo.unifiedMarginStatus === 1 ? 'default' :     // 經典帳戶
                        accountInfo.unifiedMarginStatus === 3 ? 'blue' :        // 統一帳戶1.0
                        accountInfo.unifiedMarginStatus === 4 ? 'cyan' :        // 統一帳戶1.0 (pro)
                        accountInfo.unifiedMarginStatus === 5 ? 'green' :       // 統一帳戶2.0
                        accountInfo.unifiedMarginStatus === 6 ? 'purple' :      // 統一帳戶2.0 (pro)
                        'orange'                                                // 未知狀態
                      }>
                        {accountInfo.unifiedMarginStatusText}
                      </Tag>
                    </Col>
                    
                    <Col span={12}>
                      <strong>帶單賬戶：</strong>
                    </Col>
                    <Col span={12}>
                      <Tag color={accountInfo.isMasterTrader ? 'green' : 'default'}>
                        {accountInfo.isMasterTrader ? '是' : '否'}
                      </Tag>
                    </Col>
                    
                    <Col span={12}>
                      <strong>現貨對衝：</strong>
                    </Col>
                    <Col span={12}>
                      <Tag color={accountInfo.spotHedgingStatus === 'ON' ? 'green' : 'default'}>
                        {accountInfo.spotHedgingStatusText}
                      </Tag>
                    </Col>
                    
                    <Col span={24} style={{ marginTop: '8px' }}>
                      <Typography.Text type="secondary">
                        賬戶更新時間：{new Date(parseInt(accountInfo.updatedTime)).toLocaleString()}
                      </Typography.Text>
                    </Col>
                  </Row>
                </div>
              )
            });
          } else {
            message.success(`${config.name} API連接測試`);
          }
        } else {
          // 更新本地狀態 - 將連接狀態設為false
          setApiConfigs(prevConfigs => 
            prevConfigs.map(cfg => 
              cfg.exchange === 'bybit' 
                ? { ...cfg, connected: false, status: 'disconnected' }
                : cfg
            )
          );
          
          const errorMsg = responseData.data?.message || 'API連接測試失敗';

          Modal.error({
            title: `${config.name} API測試失敗`,
            width: 500,
            content: (
              <div>
                <p><strong>錯誤信息：</strong>{errorMsg}</p>
                <p style={{ marginTop: '12px', color: '#666', fontSize: '12px' }}>
                  請檢查：<br/>
                  • API 密鑰是否正確配置<br/>
                  • API 密鑰是否具有必要的權限<br/>
                  • 網路連接是否正常
                </p>
              </div>
            )
          });
        }
      } else {
        // 其他交易所暫時不支援測試
        message.info(`${config.name} 測試功能開發中，暫時無法使用。請期待後續版本！`);
      }
    } catch (error: any) {
      message.error(`${config.name} API連接測試失敗: ` + (error.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  // 重置為默認設定
  const handleResetRiskSettings = () => {
    riskForm.setFieldsValue({
      maxPositionSize: 10000,
      maxDailyLoss: 1000,
      priceDeviationThreshold: 5,
    });
    message.info('已重置為默認設定');
  };

  return (
    <div>
      {/* 頁面標題 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          ⚙️ 系統設定
        </Title>
      </div>

      <Tabs defaultActiveKey="risk" type="card">
        <TabPane
          tab={
            <span>
              <SafetyOutlined />
              風險控制
            </span>
          }
          key="risk"
        >
          <Card className="card-shadow">


            <Form
              form={riskForm}
              layout="vertical"
              onFinish={handleSaveRiskSettings}
              initialValues={{
                maxPositionSize: 10000,
                maxDailyLoss: 1000,
                priceDeviationThreshold: 5,
              }}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="maxPositionSize"
                    label="最大單筆交易金額"
                    rules={[{ required: true, message: '請輸入最大單筆交易金額' }]}
                    extra="單筆交易允許的最大金額，超過此限制將被系統拒絕"
                  >
                    <InputNumber
                      min={100}
                      max={1000000}
                      step={100}
                      style={{ width: '100%' }}
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => (Number(value!.replace(/\$\s?|(,*)/g, '')) || 0) as any}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="maxDailyLoss"
                    label="每日最大虧損限制"
                    rules={[{ required: true, message: '請輸入每日最大虧損限制' }]}
                    extra="當日虧損達到此限制時，系統將停止所有交易"
                  >
                    <InputNumber
                      min={100}
                      max={100000}
                      step={100}
                      style={{ width: '100%' }}
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => (Number(value!.replace(/\$\s?|(,*)/g, '')) || 0) as any}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="priceDeviationThreshold"
                    label="價格偏差閾值 (%)"
                    rules={[{ required: true, message: '請輸入價格偏差閾值' }]}
                    extra="當價格偏差超過此閾值時，系統將暫停相關交易"
                  >
                    <InputNumber
                      min={0.1}
                      max={50}
                      step={0.1}
                      precision={1}
                      style={{ width: '100%' }}
                      formatter={value => `${value}%`}
                      parser={value => (Number(value!.replace('%', '')) || 0) as any}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <div style={{ marginTop: 32 }}>
                    <Alert
                      message="當前狀態"
                      description={
                        <div>
                          <p>今日盈虧: <Text className={engineStatus.stats.todayProfit >= 0 ? 'price-positive' : 'price-negative'}>
                            ${engineStatus.stats.todayProfit ? engineStatus.stats.todayProfit.toFixed(2) : '0.00'}
                          </Text></p>
                          <p>成功交易: {engineStatus.stats.successfulTrades}/{engineStatus.stats.totalTrades}</p>
                        </div>
                      }
                      type="success"
                      showIcon
                    />
                  </div>
                </Col>
              </Row>

              <Divider />

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    保存設定
                  </Button>
                  <Button 
                    onClick={handleResetRiskSettings}
                    icon={<ReloadOutlined />}
                  >
                    重置默認
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ApiOutlined />
              API設定
            </span>
          }
          key="api"
        >
          <Card className="card-shadow">
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddApi}
                  loading={loading}
                >
                  新增 API
                </Button>
                <Typography.Text type="secondary">
                  管理您的交易所API密鑰配置
                </Typography.Text>
              </Space>
            </div>

            {/* API配置列表 */}
            {apiConfigs.length > 0 ? (
              <List
                dataSource={apiConfigs}
                renderItem={(config) => (
                  <List.Item
                    actions={[
                      <Button 
                        type="link" 
                        icon={<EditOutlined />} 
                        onClick={() => handleEditApi(config)}
                        loading={loading}
                      >
                        編輯
                      </Button>,
                      <Button 
                        type="link" 
                        icon={<ReloadOutlined />} 
                        onClick={() => handleTestApiConnection(config)}
                        loading={loading}
                      >
                        測試
                      </Button>,
                      <Popconfirm
                        title="確定要刪除此API配置嗎？"
                        description="刪除後將無法恢復，請謹慎操作。"
                        onConfirm={() => handleDeleteApi(config)}
                        okText="確定"
                        cancelText="取消"
                      >
                        <Button 
                          type="link" 
                          danger 
                          icon={<DeleteOutlined />}
                          loading={loading}
                        >
                          刪除
                        </Button>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<span style={{ fontSize: '24px' }}>{config.icon}</span>}
                      title={
                        <Space>
                          <span>{config.name}</span>
                          <Tag 
                            color={config.connected ? 'green' : 'orange'}
                            icon={config.connected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                          >
                            {config.connected ? '已連接' : '未連接'}
                          </Tag>
                        </Space>
                      }
                      description={`${config.name} 交易所API配置`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 0',
                color: '#999'
              }}>
                <ApiOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div>尚未配置任何API</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  點擊「新增 API」按鈕開始配置您的交易所API
                </div>
              </div>
            )}

            {/* 支援的交易所說明 */}
            <Divider />
            <Typography.Title level={5}>支援的交易所</Typography.Title>
            <Row gutter={[16, 16]}>
              {supportedExchanges.map((exchange) => (
                <Col xs={12} sm={8} md={6} key={exchange.key}>
                  <Card size="small" style={{ textAlign: 'center', height: '120px' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                      {exchange.icon}
                    </div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{exchange.name}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                      {exchange.description}
                    </div>
                    <Tag 
                      color={exchange.status === 'active' ? 'green' : 'orange'}
                      style={{ fontSize: '10px' }}
                    >
                      {exchange.status === 'active' ? '可用' : '開發中'}
                    </Tag>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* API配置模態框 */}
          <Modal
            title={editingApi ? `編輯 ${editingApi.name} API` : '新增 API 配置'}
            open={isApiModalVisible}
            onCancel={() => setIsApiModalVisible(false)}
            footer={null}
            width={600}
          >
            <Form
              form={apiForm}
              layout="vertical"
              onFinish={handleSaveApi}
              initialValues={{ exchange: 'bybit' }}
            >
              <Form.Item
                name="exchange"
                label="選擇交易所"
                rules={[{ required: true, message: '請選擇交易所' }]}
              >
                <Select
                  placeholder="請選擇要配置的交易所"
                  disabled={!!editingApi}
                >
                  {supportedExchanges.map((exchange) => (
                    <Select.Option 
                      key={exchange.key} 
                      value={exchange.key}
                      disabled={false} // 允許選擇所有交易所，但在保存時會有提示
                    >
                      <Space>
                        <span>{exchange.icon}</span>
                        <span>{exchange.name}</span>
                        <Tag 
                          color={exchange.status === 'active' ? 'green' : 'orange'} 
                          style={{ fontSize: '12px' }}
                        >
                          {exchange.status === 'active' ? '可用' : '開發中'}
                        </Tag>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="apiKey"
                label="API Key"
                rules={[{ required: true, message: '請輸入API Key' }]}
              >
                <Input.Password placeholder="請輸入API Key" />
              </Form.Item>

              <Form.Item
                name="secret"
                label="Secret Key"
                rules={[{ required: true, message: '請輸入Secret Key' }]}
              >
                <Input.Password placeholder="請輸入Secret Key" />
              </Form.Item>

              <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.exchange !== currentValues.exchange}>
                {({ getFieldValue }) => {
                  const selectedExchange = supportedExchanges.find(e => e.key === getFieldValue('exchange'));
                  
                  return (
                    <>
                      {selectedExchange?.fields.includes('passphrase') && (
                        <Form.Item
                          name="passphrase"
                          label="Passphrase"
                          rules={[{ required: true, message: '請輸入Passphrase' }]}
                        >
                          <Input.Password placeholder="請輸入Passphrase" />
                        </Form.Item>
                      )}
                      
                      {selectedExchange?.status === 'coming_soon' && (
                        <Alert
                          message="開發中功能"
                          description={`${selectedExchange.name} 交易所功能正在開發中。您可以填入API資訊，但暫時無法保存和使用。請期待後續版本更新！`}
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}
                    </>
                  );
                }}
              </Form.Item>

              <Alert
                message="安全提醒"
                description="API密鑰具有交易權限，請妥善保管。建議使用子帳戶API並限制IP白名單。本系統使用真實交易平台，所有交易都將在實際市場中執行。"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setIsApiModalVisible(false)}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    {editingApi ? '更新配置' : '保存配置'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>
        </TabPane>

        <TabPane
          tab={
            <span>
              <SettingOutlined />
              系統信息
            </span>
          }
          key="system"
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Card title="系統狀態" className="card-shadow">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>套利引擎:</Text>
                    <Text className={engineStatus.isRunning ? 'status-online' : 'status-offline'}>
                      {engineStatus.isRunning ? '運行中' : '已停止'}
                    </Text>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>總交易次數:</Text>
                    <Text>{engineStatus.stats.totalTrades}</Text>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>成功率:</Text>
                    <Text>
                      {engineStatus.stats.totalTrades > 0 
                        ? ((engineStatus.stats.successfulTrades / engineStatus.stats.totalTrades) * 100).toFixed(1)
                        : '0'
                      }%
                    </Text>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>總收益:</Text>
                    <Text className={engineStatus.stats.totalProfit >= 0 ? 'price-positive' : 'price-negative'}>
                      ${engineStatus.stats.totalProfit ? engineStatus.stats.totalProfit.toFixed(2) : '0.00'}
                    </Text>
                  </div>
                </Space>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title="交易所狀態" className="card-shadow">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {Object.entries(exchanges).map(([key, exchange]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{exchange.name}:</Text>
                      <Text className={
                        exchange.connected ? 'status-online' : 
                        (exchange as any).comingSoon ? 'status-warning' : 'status-offline'
                      }>
                        {exchange.connected ? '已連接' : 
                         (exchange as any).comingSoon ? '即將支援' : '未連接'}
                      </Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>

          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card title="版本信息" className="card-shadow">
                <Paragraph>
                  <Text strong>雙腿套利交易系統 v1.0.0</Text>
                </Paragraph>

                <Paragraph>
                  <Text type="secondary">
                    • 支援跨交易所套利監控<br/>
                    • 即時 bid1/ask1 價差分析<br/>
                    • 智能 TWAP 策略執行<br/>
                    • 完善的風險控制機制<br/>
                    • 專業的交易界面設計
                  </Text>
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
