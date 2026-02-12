import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ProcessResult {
  fileName: string;
  rowCount: number;
  groupCount: number;
}

interface DataRow {
  sentiment_tag?: string;
  opinion?: string;
  tf?: number;
  raw_comments?: string;
  [key: string]: any;
}

const AnnotatedDataProcessor = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setError('请上传 .xlsx 或 .xls 格式的文件');
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
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    } else {
      setError('请上传 .xlsx 或 .xls 格式的文件');
    }
  };

  const processFile = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);

    try {
      // 读取 Excel 文件
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // 获取第一个工作表
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // 校验列标题
      const requiredColumns = [
        'part_time', 'firstcategoryname', 'name', 'cid', 'sentiment_tag',
        'begin_time', 'end_time', 'index_', 'opinion', 'score', 'num',
        'raw_comments', 'tf'
      ];
      
      // 获取实际的列标题（从第一行）
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const actualColumns: string[] = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = worksheet[cellAddress];
        // 即使单元格为空，也要记录下来
        if (cell && cell.v) {
          actualColumns.push(String(cell.v).toLowerCase().trim());
        } else {
          actualColumns.push(''); // 空列名用空字符串表示
        }
      }
      
      // 校验列数
      if (actualColumns.length !== 13) {
        const errorMsg = actualColumns.length > 13 
          ? `文件列数错误：文件包含 ${actualColumns.length} 列，但必须恰好包含 13 列。\n\n您的文件列名：\n${actualColumns.join(', ')}\n\n要求的 13 列：\n${requiredColumns.join(', ')}\n\n❗ 操作建议：请删除不符合要求的列，确保文件仅包含上述 13 列。`
          : `文件列数错误：文件仅包含 ${actualColumns.length} 列，但必须包含 13 列。\n\n您的文件列名：\n${actualColumns.join(', ')}\n\n要求的 13 列：\n${requiredColumns.join(', ')}\n\n❗ 操作建议：请补充缺失的列。`;
        throw new Error(errorMsg);
      }
      
      // 校验列标题和顺序
      const requiredColumnsLower = requiredColumns.map(c => c.toLowerCase());
      for (let i = 0; i < requiredColumnsLower.length; i++) {
        if (actualColumns[i] !== requiredColumnsLower[i]) {
          const actualColName = actualColumns[i] || '(空)';
          let errorMsg = `第 ${i + 1} 列错误：\n期望列名：${requiredColumns[i]}\n实际列名：${actualColName}\n\n`;
          
          // 如果是空列名，给出更具体的提示
          if (!actualColumns[i]) {
            errorMsg += `❗ 操作建议：第 ${i + 1} 列的标题为空，请在该列的首行（标题行）输入列名 "${requiredColumns[i]}"\n\n`;
          } else {
            errorMsg += `❗ 操作建议：请将第 ${i + 1} 列的标题修改为 "${requiredColumns[i]}"\n\n`;
          }
          
          errorMsg += `完整的列要求（按顺序）：\n${requiredColumns.join(', ')}`;
          
          throw new Error(errorMsg);
        }
      }
      
      // 转换为 JSON 数据
      const jsonData: DataRow[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('Excel 文件为空');
      }

      // 按 sentiment_tag 和 opinion 分组
      const groups = new Map<string, DataRow[]>();
      
      for (const row of jsonData) {
        const key = `${row.sentiment_tag || ''}_${row.opinion || ''}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(row);
      }

      // 处理每个组
      const newData: DataRow[] = [];
      
      for (const group of groups.values()) {
        // 计算 tf 总和
        const tfSum = group.reduce((sum, row) => sum + (row.tf || 0), 0);
        
        // 如果 tf 总和为 0，跳过这个组
        if (tfSum === 0) {
          continue;
        }

        // 合并 raw_comments
        const rawComments = group
          .map(row => row.raw_comments || '')
          .filter(comment => comment.trim() !== '')
          .join('$');

        // 使用组的第一行数据作为基础
        const item = { ...group[0] };
        item.raw_comments = rawComments;
        
        newData.push(item);
      }

      // 重命名 tf 为 done_time
      const renamedData = newData.map(row => {
        const newRow: any = {};
        for (const key in row) {
          if (key === 'tf') {
            newRow['done_time'] = row[key];
          } else {
            newRow[key] = row[key];
          }
        }
        return newRow;
      });

      // 生成 CSV 内容（带 BOM 以支持中文）
      const ws = XLSX.utils.json_to_sheet(renamedData);
      const csv = XLSX.utils.sheet_to_csv(ws);
      
      // 添加 UTF-8 BOM
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csv;
      
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });

      // 生成输出文件名
      const baseFileName = file.name.replace(/\.(xlsx|xls)$/, '');
      const outputFileName = `${baseFileName}-输出.csv`;

      // 保存结果
      setResult({
        fileName: outputFileName,
        rowCount: renamedData.length,
        groupCount: groups.size
      });

      // 创建下载链接
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
      <h2 className="processor-title">标注后数据处理</h2>
      <p className="processor-description">
        请上传标注后的excel文件，并将生成的csv文件下载后提供给产品用于上传
      </p>

      <div 
        className={`upload-section ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📊</div>
        <label htmlFor="annotated-file-input" className="file-input-label">
          选择 Excel 文件
        </label>
        <input
          id="annotated-file-input"
          type="file"
          accept=".xlsx,.xls"
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
            <p><strong>原始分组数:</strong> {result.groupCount} 组</p>
            <p><strong>有效数据行:</strong> {result.rowCount} 行（tf 总和 &gt; 0 的组）</p>
          </div>
          <button onClick={downloadFile} className="download-button">
            下载 CSV 文件
          </button>
          <button onClick={reset} className="reset-button" style={{width: '100%', marginTop: '10px'}}>
            处理新文件
          </button>
        </div>
      )}
    </div>
  );
};

export default AnnotatedDataProcessor;
