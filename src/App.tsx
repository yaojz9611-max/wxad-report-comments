import { useState } from 'react';
import './App.css';
import RawDataProcessor from './components/RawDataProcessor';
import AnnotatedDataProcessor from './components/AnnotatedDataProcessor';

type ProcessedTableData = {
  sourceFileName: string;
  columns: string[];
  rows: string[][];
};

function App() {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [processedTableData, setProcessedTableData] = useState<ProcessedTableData | null>(null);
  const [preferredMethod, setPreferredMethod] = useState<'online' | 'offline'>('online');

  const handleDataProcessed = (data: ProcessedTableData | null, method: 'online' | 'offline' = 'online') => {
    setProcessedTableData(data);
    setPreferredMethod(method);
    if (data) {
      // 数据处理完成后，自动进入第二步
      setCurrentStep(2);
    }
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
  };

  const handleResetAll = () => {
    setCurrentStep(1);
    setProcessedTableData(null);
    setPreferredMethod('online');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>结案报告评论数据处理工具</h1>
        <p className="subtitle">仅限合约广告处理结案评论数据使用，如有疑问请企业微信联系chelseayao</p>
      </header>

      <div className="steps-indicator">
        <div className={`step-item ${currentStep === 1 ? 'active' : 'completed'}`}>
          <div className="step-number">{currentStep > 1 ? '✓' : '1'}</div>
          <div className="step-label">原始数据处理</div>
        </div>
        <div className="step-divider"></div>
        <div className={`step-item ${currentStep === 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">标注后数据处理</div>
        </div>
      </div>

      <div className="content-container">
        {currentStep === 1 ? (
          <RawDataProcessor
            onDataChange={setProcessedTableData}
            onGoToNext={handleDataProcessed}
            initialData={processedTableData}
          />
        ) : (
          <AnnotatedDataProcessor
            inputTableData={processedTableData}
            onGoToStep1={handleBackToStep1}
            preferredMethod={preferredMethod}
            onResetAll={handleResetAll}
          />
        )}
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
