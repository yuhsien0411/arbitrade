/**
 * React應用入口文件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-tw';

import App from './App';
import { store } from './store';
import './index.css';

// 設置dayjs為繁體中文
dayjs.locale('zh-tw');

// Ant Design 主題配置
const theme = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Layout: {
      bodyBg: '#f0f2f5',
      headerBg: '#001529',
      siderBg: '#001529',
    },
    Card: {
      borderRadius: 8,
    },
    Button: {
      borderRadius: 6,
    },
    Input: {
      borderRadius: 6,
    },
    Select: {
      borderRadius: 6,
    },
    Table: {
      borderRadius: 8,
    },
  },
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfigProvider 
          locale={zhTW} 
          theme={theme}
        >
          <AntdApp>
            <App />
          </AntdApp>
        </ConfigProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
