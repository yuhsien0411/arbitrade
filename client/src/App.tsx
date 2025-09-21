/**
 * 主應用組件
 * 參考Taoli Tools設計理念，提供專業的交易界面
 */

import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, App as AntdApp } from 'antd';
import { useDispatch } from 'react-redux';

import AppHeader from './components/AppHeader';
import AppSider from './components/AppSider';
import Dashboard from './pages/Dashboard';
import ArbitragePage from './pages/ArbitragePage';
import TwapPage from './pages/TwapPage';
import SettingsPage from './pages/SettingsPage';
import { connectWebSocket } from './services/websocket';
import logger from './utils/logger';
import { apiService } from './services/api';
import { AppDispatch } from './store';
import { updateExchanges } from './store/slices/systemSlice';
// 只保留實際使用的導入
import ClearDataService from './services/clearDataService';

const { Content } = Layout;

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = AntdApp.useApp();

  // 在組件加載前清空所有資料（在 useEffect 之外執行）
  React.useLayoutEffect(() => {
    // 清空 localStorage 中的所有資料
    const { clearAll } = require('./utils/storage').default;
    clearAll();
    
    // 設置初始化標記
    sessionStorage.setItem('app_just_started', 'true');
    
    logger.info('應用程式啟動時清空本地存儲', {}, 'App');
  }, []);
  
  useEffect(() => {
    // 重新啟動時清空所有資料
    const initializeApp = async () => {
      try {
        // 清空後端資料
        await ClearDataService.clearBackendData();
        
        // 清空前端 Redux 狀態
        ClearDataService.clearFrontendData();
        
        logger.info('應用程式初始化完成，前後端資料已清空', {}, 'App');
      } catch (error) {
        logger.error('應用程式初始化失敗', error, 'App');
      }
    };

    // 載入交易所信息（延遲載入，避免初始請求）
    const loadExchanges = async () => {
      try {
        const response = await apiService.getExchanges();
        if (response.data) {
          dispatch(updateExchanges(response.data));
        }
      } catch (error) {
        logger.error('載入交易所信息失敗', error, 'App');
      }
    };

    // 先清空資料，再載入交易所信息
    initializeApp();
    
    // 延遲 2 秒載入，避免初始頁面載入時的請求
    const timer = setTimeout(loadExchanges, 2000);

    // 連接WebSocket
    const cleanup = connectWebSocket(dispatch);

    // 顯示歡迎消息
    message.success('歡迎使用雙腿套利交易系統！');

    // 清理函數
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [dispatch, message]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Layout>
        <AppSider />
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/arbitrage" element={<ArbitragePage />} />
              <Route path="/twap" element={<TwapPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
