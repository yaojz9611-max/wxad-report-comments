import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

type InputTableData = {
  sourceFileName: string;
  columns: string[];
  rows: string[][];
};

type Props = {
  inputTableData?: InputTableData | null;
  onGoToStep1?: () => void;
  preferredMethod?: 'online' | 'offline';
  onResetAll?: () => void;
};

interface ProcessResult {
  fileName: string;
  rowCount: number;
  groupCount: number;
}

interface DataRow {
  sentiment_tag?: string;
  opinion?: string;
  tf?: number | string;
  raw_comments?: string;
  [key: string]: any;
}

const REQUIRED_COLUMNS = [
  'part_time', 'firstcategoryname', 'name', 'cid', 'sentiment_tag',
  'begin_time', 'end_time', 'index_', 'opinion', 'score', 'num',
  'raw_comments', 'tf'
];

const validateColumns = (columns: string[]) => {
  if (columns.length !== REQUIRED_COLUMNS.length) {
    const yourCols = columns.join(', ');
    const required = REQUIRED_COLUMNS.join(', ');
    if (columns.length > REQUIRED_COLUMNS.length) {
      throw new Error(
        `文件列数错误：文件包含 ${columns.length} 列，但必须恰好包含 13 列。\n\n您的文件列名：\n${yourCols}\n\n要求的 13 列：\n${required}\n\n❗ 操作建议：请删除不符合要求的列，确保文件仅包含上述 13 列。`
      );
    }
    throw new Error(
      `文件列数错误：文件仅包含 ${columns.length} 列，但必须包含 13 列。\n\n您的文件列名：\n${yourCols}\n\n要求的 13 列：\n${required}\n\n❗ 操作建议：请补充缺失的列。`
    );
  }

  for (let i = 0; i < REQUIRED_COLUMNS.length; i++) {
    if (columns[i] !== REQUIRED_COLUMNS[i]) {
      const actualColName = columns[i] || '(空)';
      let errorMsg = `第 ${i + 1} 列错误：\n期望列名：${REQUIRED_COLUMNS[i]}\n实际列名：${actualColName}\n\n`;

      if (!columns[i]) {
        errorMsg += `❗ 操作建议：第 ${i + 1} 列的标题为空，请在该列的首行（标题行）输入列名 "${REQUIRED_COLUMNS[i]}"\n\n`;
      } else {
        errorMsg += `❗ 操作建议：请将第 ${i + 1} 列的标题修改为 "${REQUIRED_COLUMNS[i]}"\n\n`;
      }

      errorMsg += `完整的列要求（按顺序）：\n${REQUIRED_COLUMNS.join(', ')}`;
      throw new Error(errorMsg);
    }
  }
};

const toBaseName = (fileName: string) => {
  return fileName.replace(/\.[^.]+$/, '');
};

const getActualColumnsFromWorksheet = (worksheet: XLSX.WorkSheet) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const actualColumns: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = worksheet[cellAddress];
    if (cell && cell.v) {
      actualColumns.push(String(cell.v).toLowerCase().trim());
    } else {
      actualColumns.push('');
    }
  }
  return actualColumns;
};

const normalizeTf = (v: unknown) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === '') return 0;
  if (s === '0') return 0;
  if (s === '1') return 1;
  throw new Error(`tf 列仅支持 0 或 1，发现非法值：${s}`);
};

const AnnotatedDataProcessor = ({ inputTableData, onGoToStep1, preferredMethod = 'online', onResetAll }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'online' | 'offline'>(preferredMethod);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string | null>(null);

  // Toast提示函数
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  // 当preferredMethod变化时更新selectedMethod
  useEffect(() => {
    setSelectedMethod(preferredMethod);
  }, [preferredMethod]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const inputSummary = useMemo(() => {
    if (!inputTableData) return null;
    return {
      rowCount: inputTableData.rows.length,
      source: inputTableData.sourceFileName
    };
  }, [inputTableData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setError('请上传 .xlsx 或 .xls 格式的文件');
    }
    // 重置input value，允许重复选择同一个文件
    event.target.value = '';
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

  const setDownload = (url: string, name: string) => {
    setDownloadUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setDownloadFileName(name);
  };

  const generateCsvBlob = (rows: DataRow[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const BOM = '\uFEFF';
    return new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  };

  const transformAndAggregate = (jsonData: DataRow[]) => {
    if (jsonData.length === 0) {
      throw new Error('数据为空');
    }

    // tf 校验与归一化（确保后续 reduce 不出错）
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      try {
        row.tf = normalizeTf(row.tf);
      } catch (e) {
        throw new Error(`第 ${i + 2} 行（含表头）tf 值错误：${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const groups = new Map<string, DataRow[]>();

    for (const row of jsonData) {
      const key = `${row.sentiment_tag || ''}_${row.opinion || ''}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    const newData: DataRow[] = [];

    for (const group of groups.values()) {
      const tfSum = group.reduce((sum, row) => sum + (Number(row.tf) || 0), 0);
      if (tfSum === 0) continue;

      const rawComments = group
        .map(row => row.raw_comments || '')
        .filter(comment => String(comment).trim() !== '')
        .join('$');

      const item = { ...group[0] };
      item.raw_comments = rawComments;
      newData.push(item);
    }

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

    return { renamedData, groupCount: groups.size };
  };

  const processFromFile = async (f: File) => {
    const arrayBuffer = await f.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const actualColumns = getActualColumnsFromWorksheet(worksheet);
    validateColumns(actualColumns);

    const jsonData: DataRow[] = XLSX.utils.sheet_to_json(worksheet);
    if (jsonData.length === 0) throw new Error('Excel 文件为空');

    const { renamedData, groupCount } = transformAndAggregate(jsonData);

    const blob = generateCsvBlob(renamedData);
    const outputFileName = `${toBaseName(f.name)}-输出.csv`;

    setResult({ fileName: outputFileName, rowCount: renamedData.length, groupCount });
    setDownload(URL.createObjectURL(blob), outputFileName);
    
    // 显示toast提示
    showToastMessage('✅ 处理完成！');
  };

  const processFromInputTable = async (t: InputTableData) => {
    const columns = t.columns.map(c => String(c).toLowerCase().trim());
    validateColumns(columns);

    const tfIndex = columns.indexOf('tf');
    if (tfIndex < 0) {
      throw new Error('缺少 tf 列');
    }

    const jsonData: DataRow[] = t.rows.map((row) => {
      const obj: any = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = row[i];
      }
      return obj;
    });

    const { renamedData, groupCount } = transformAndAggregate(jsonData);

    const blob = generateCsvBlob(renamedData);
    const outputFileName = `${toBaseName(t.sourceFileName)}-输出.csv`;

    setResult({ fileName: outputFileName, rowCount: renamedData.length, groupCount });
    setDownload(URL.createObjectURL(blob), outputFileName);
    
    // 显示toast提示
    showToastMessage('✅ 处理完成！');
  };

  const processFile = async () => {
    // 优先用用户手动上传的文件；否则尝试用来自"原始数据处理"的数据
    if (!file && !inputTableData) {
      setError('请上传 Excel 文件，或先在「原始数据处理」里生成并标注数据');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      setResult(null);

      if (file) {
        await processFromFile(file);
      } else if (inputTableData) {
        await processFromInputTable(inputTableData);
      }
    } catch (err) {
      setError(`处理失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = () => {
    if (downloadUrl && downloadFileName) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProcessing(false);
    setDownloadUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setDownloadFileName(null);
  };

  const handleResetConfirm = () => {
    setShowResetConfirm(false);
    if (onResetAll) {
      onResetAll();
    }
  };

  const handleResetCancel = () => {
    setShowResetConfirm(false);
  };

  return (
    <div className="processor-container">
      <div className="step-header">
        <h2 className="step-title">📊 第二步：标注后数据处理</h2>
        <p className="step-description">
          系统已接收第一步的数据，点击下方按钮即可生成最终的 CSV 文件。
        </p>
      </div>

      <div className="step2-processing-options">
        {inputSummary && selectedMethod === 'online' && (
          <div className="step2-option-card primary-option">
            <div className="option-badge">使用第一步的数据</div>
            <div className="data-ready-card">
              <div className="data-ready-icon">✓</div>
              <div className="data-ready-content">
                <div className="data-ready-title">使用第一步的数据</div>
                <div className="data-ready-text">
                  源文件：<strong>{inputSummary.source}</strong> · 共 <strong>{inputSummary.rowCount}</strong> 行数据
                </div>
              </div>
              <button className="link-button" onClick={onGoToStep1} disabled={!onGoToStep1}>
                ← 返回修改
              </button>
            </div>
            {!processing && !result && (
              <button onClick={processFile} className="primary-action-button" style={{ width: '100%', marginTop: '16px' }}>
                生成 CSV 文件
              </button>
            )}
          </div>
        )}

        {selectedMethod === 'offline' && (
          <div className={`step2-option-card ${!inputSummary ? 'primary-option' : ''}`}>
            <div className="option-badge">上传 Excel 文件</div>
            <div className="upload-option-header">
              <div className="upload-option-title">
                <span className="upload-option-icon">📊</span>
                上传手动标注的 Excel 文件
              </div>
              <p className="upload-option-description">
                如果你已在离线完成标注，直接上传 Excel 文件即可生成 CSV
              </p>
            </div>
          
            <div
              className={`upload-section-compact ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ marginTop: '12px' }}
            >
              {!file ? (
                <div className="upload-compact-content">
                  <div className="upload-icon-small">📊</div>
                  <div className="upload-compact-text">
                    <label htmlFor="annotated-file-input" className="file-input-label-compact">
                      选择 Excel 文件
                    </label>
                    <span className="upload-hint">或拖拽文件到此处</span>
                  </div>
                </div>
              ) : (
                <div className="upload-file-ready">
                  <div className="file-ready-icon">✓</div>
                  <div className="file-ready-info">
                    <div className="file-ready-name">{file.name}</div>
                    <div className="file-ready-size">{(file.size / 1024).toFixed(2)} KB</div>
                  </div>
                  <div className="file-ready-actions">
                    <label htmlFor="annotated-file-input-change" className="file-change-button">
                      修改文件
                    </label>
                    <button onClick={reset} className="file-delete-button">
                      删除文件
                    </button>
                  </div>
                </div>
              )}
              <input
                id="annotated-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="file-input"
              />
              <input
                id="annotated-file-input-change"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="file-input"
              />
            </div>

            {file && !processing && !result && (
              <button onClick={processFile} className="primary-action-button" style={{ width: '100%', marginTop: '16px' }}>
                处理并生成 CSV
              </button>
            )}
          </div>
        )}

        {selectedMethod === 'online' && !inputSummary && !file && (
          <div className="step2-hint-card">
            <div className="hint-icon">💡</div>
            <div className="hint-text">
              提示：你可以先完成<button className="inline-link-button" onClick={onGoToStep1} disabled={!onGoToStep1}>第一步</button>的数据处理，或直接上传已标注的 Excel 文件
            </div>
          </div>
        )}
      </div>

      {/* 底部返回按钮 */}
      {!processing && !result && (
        <div className="step2-back-action">
          <button
            className="back-to-step1-button"
            onClick={onGoToStep1}
            disabled={!onGoToStep1}
          >
            ← 返回上一步
          </button>
        </div>
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
            重置
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
          <button onClick={downloadFile} className="download-button" disabled={!downloadUrl}>
            下载 CSV 文件
          </button>
          <div className="reset-new-data-action">
            <button onClick={() => setShowResetConfirm(true)} className="reset-new-data-button">
              处理新的评论数据 →
            </button>
          </div>
        </div>
      )}

      {/* 二次确认弹窗 */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={handleResetCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">确认操作</h3>
            <p className="modal-text">
              确认要处理新的数据吗？此操作将清空历史操作记录，请确认需要的文件均已下载并保存。
            </p>
            <div className="modal-buttons">
              <button onClick={handleResetConfirm} className="modal-confirm-button">
                确认
              </button>
              <button onClick={handleResetCancel} className="modal-cancel-button">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast提示 */}
      {showToast && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default AnnotatedDataProcessor;
