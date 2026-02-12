import { useState } from 'react';
import './App.css';
import RawDataProcessor from './components/RawDataProcessor';
import AnnotatedDataProcessor from './components/AnnotatedDataProcessor';

function App() {
  const [activeTab, setActiveTab] = useState<'raw' | 'annotated'>('raw');

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>结案报告评论数据处理工具</h1>
        <p className="subtitle">仅限合约广告处理结案评论数据使用，如有疑问请企业微信联系chelseayao</p>
      </header>

      <div className="tab-container">
        <button
          className={`tab-button ${activeTab === 'raw' ? 'active' : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          📄 原始数据处理
        </button>
        <button
          className={`tab-button ${activeTab === 'annotated' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotated')}
        >
          📊 标注后数据处理
        </button>
      </div>

      <div className="content-container">
        {activeTab === 'raw' ? <RawDataProcessor /> : <AnnotatedDataProcessor />}
      </div>

      <footer className="app-footer">
        <div className="privacy-notice">
          <div className="privacy-icon">🔒</div>
          <div className="privacy-content">
            <h3>隐私保护承诺</h3>
            <p>
              <strong>100% 本地处理：</strong>所有数据处理均在您的浏览器本地完成，文件不会上传到任何服务器。
              我们无法访问、存储或查看您的任何数据。您的隐私得到完全保护。
            </p>
            <p className="privacy-detail">
              ✓ 无服务器上传 &nbsp;&nbsp; ✓ 无数据存储 &nbsp;&nbsp; ✓ 无日志记录 &nbsp;&nbsp; ✓ 完全匿名使用
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
