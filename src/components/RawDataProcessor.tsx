import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ProcessResult {
  fileName: string;
  rowCount: number;
  columnCount: number;
  data: unknown[][];
}

const RawDataProcessor = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.txt')) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setError('请上传 .txt 格式的文件');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith('.txt')) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    } else {
      setError('请上传 .txt 格式的文件');
    }
  };

  const processFile = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);

    try {
      // 读取文件内容
      const text = await file.text();
      const lines = text.split('\n');

      if (lines.length === 0) {
        throw new Error('文件为空');
      }

      // 处理第一行作为列名
      let columns = lines[0]
        .trim()
        .replace(/\ufeff/g, '')
        .replace(/\u0001/g, '')
        .replace(/\x02/g, '')
        .replace(/\u0002/g, '')
        .split('\t');

      const data: string[][] = [];

      // 处理数据行
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const ele = line
          .replace(/\ufeff/g, ' ')
          .replace(/\u0001/g, ' ')
          .replace(/\x02/g, ' ')
          .replace(/\u0002/g, ' ')
          .split('\t');

        // 只保留列数匹配的行
        if (columns.length === ele.length) {
          data.push(ele.map(x => x.trim()));
        }
      }

      // 展开 raw_comments 列（按 $ 分隔）
      const rawCommentsIndex = columns.indexOf('raw_comments');
      const expandedData: string[][] = [];

      if (rawCommentsIndex !== -1) {
        // 找到 raw_comments 列，需要展开
        for (const row of data) {
          const comments = row[rawCommentsIndex].split('$');
          for (const comment of comments) {
            const newRow = [...row];
            newRow[rawCommentsIndex] = comment.trim();
            expandedData.push(newRow);
          }
        }
      } else {
        // 没有 raw_comments 列，直接使用原数据
        expandedData.push(...data);
      }

      // 创建 Excel 工作簿
      const ws = XLSX.utils.aoa_to_sheet([columns, ...expandedData]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      // 生成 Excel 文件
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // 保存结果
      const outputFileName = file.name.replace('.txt', '.xlsx');
      setResult({
        fileName: outputFileName,
        rowCount: expandedData.length,
        columnCount: columns.length,
        data: [columns, ...expandedData.slice(0, 5)] // 只保存前5行用于预览
      });

      // 创建下载链接（暂存在内存中）
      const url = URL.createObjectURL(blob);
      (window as any).downloadUrl = url;
      (window as any).downloadFileName = outputFileName;

    } catch (err) {
      setError(`处理失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = () => {
    if ((window as any).downloadUrl && (window as any).downloadFileName) {
      const a = document.createElement('a');
      a.href = (window as any).downloadUrl;
      a.download = (window as any).downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if ((window as any).downloadUrl) {
      URL.revokeObjectURL((window as any).downloadUrl);
      delete (window as any).downloadUrl;
      delete (window as any).downloadFileName;
    }
  };

  return (
    <div className="processor-container">
      <h2 className="processor-title">原始数据处理</h2>
      <p className="processor-description">
        上传txt文件，系统会自动处理为excel文件供下载。下载后请在excel文件的最右新增一列，并将该列的标题设置为"tf"（请务必不要添加其他列，否则会导致上传失败）
      </p>

      <div 
        className={`upload-section ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <label htmlFor="raw-file-input" className="file-input-label">
          选择 TXT 文件
        </label>
        <input
          id="raw-file-input"
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          className="file-input"
        />
        <p className="upload-text">或拖拽文件到此处</p>
      </div>

      {file && (
        <div className="file-info">
          <span>📄</span>
          <span className="file-info-text">
            已选择: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </span>
          <button onClick={reset} className="reset-button">
            ✕
          </button>
        </div>
      )}

      {file && !processing && !result && (
        <button onClick={processFile} className="process-button">
          开始处理
        </button>
      )}

      {processing && (
        <div className="processing">
          <div className="spinner"></div>
          <p>正在处理文件，请稍候...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <div className="error-title">❌ 处理出错</div>
          <p>{error}</p>
          <button onClick={reset} className="reset-button">
            重新上传
          </button>
        </div>
      )}

      {result && (
        <div className="result-section">
          <h3 className="result-title">✅ 处理完成</h3>
          <div className="result-info">
            <p><strong>输出文件:</strong> {result.fileName}</p>
            <p><strong>数据行数:</strong> {result.rowCount} 行</p>
            <p><strong>列数:</strong> {result.columnCount} 列</p>
          </div>
          <button onClick={downloadFile} className="download-button">
            下载 Excel 文件
          </button>
          <button onClick={reset} className="reset-button" style={{width: '100%', marginTop: '10px'}}>
            处理新文件
          </button>
        </div>
      )}
    </div>
  );
};

export default RawDataProcessor;
