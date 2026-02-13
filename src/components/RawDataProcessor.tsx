import { useEffect, useMemo, useState } from 'react';

type ProcessedTableData = {
  sourceFileName: string;
  columns: string[];
  rows: string[][];
};

type Props = {
  onDataChange?: (data: ProcessedTableData | null) => void;
  onGoToNext?: (data: ProcessedTableData) => void;
};

const REQUIRED_COLUMNS = [
  'part_time', 'firstcategoryname', 'name', 'cid', 'sentiment_tag',
  'begin_time', 'end_time', 'index_', 'opinion', 'score', 'num',
  'raw_comments', 'tf'
];

const RawDataProcessor = ({ onDataChange, onGoToNext }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [tableData, setTableData] = useState<ProcessedTableData | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [tfHint, setTfHint] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const tfColumnIndex = useMemo(() => {
    if (!tableData) return -1;
    return tableData.columns.indexOf('tf');
  }, [tableData]);

  const totalRows = tableData?.rows.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    // 页面大小或数据变化时，保证 page 在合法范围内
    setPage(prev => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  useEffect(() => {
    onDataChange?.(tableData);
  }, [tableData, onDataChange]);

  const visibleRows = useMemo(() => {
    if (!tableData) return [] as string[][];
    const start = (page - 1) * pageSize;
    return tableData.rows.slice(start, start + pageSize);
  }, [tableData, page, pageSize]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.txt')) {
      setFile(selectedFile);
      setError(null);
      setTableData(null);
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
      setTableData(null);
    } else {
      setError('请上传 .txt 格式的文件');
    }
  };

  const normalizeHeader = (raw: string) => {
    return raw
      .trim()
      .replace(/\ufeff/g, '')
      .replace(/\u0001/g, '')
      .replace(/\x02/g, '')
      .replace(/\u0002/g, '')
      .toLowerCase();
  };

  const normalizeCell = (raw: string) => {
    return raw
      .replace(/\ufeff/g, ' ')
      .replace(/\u0001/g, ' ')
      .replace(/\x02/g, ' ')
      .replace(/\u0002/g, ' ')
      .trim();
  };

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

  const processFile = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);
    setTfHint(null);

    try {
      const text = await file.text();
      const lines = text.split('\n');

      if (lines.length === 0) {
        throw new Error('文件为空');
      }

      const rawHeader = lines[0]
        .trim()
        .replace(/\ufeff/g, '')
        .replace(/\u0001/g, '')
        .replace(/\x02/g, '')
        .replace(/\u0002/g, '')
        .split('\t');

      let columns = rawHeader.map(normalizeHeader);

      const data: string[][] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const ele = line.split('\t').map(normalizeCell);

        if (columns.length === ele.length) {
          data.push(ele);
        }
      }

      // 如果原文件不含 tf，则自动追加；并对每行补空值
      if (!columns.includes('tf')) {
        columns = [...columns, 'tf'];
        for (const row of data) {
          row.push('');
        }
      }

      // 展开 raw_comments 列（按 $ 分隔）
      const rawCommentsIndex = columns.indexOf('raw_comments');
      const expandedData: string[][] = [];

      if (rawCommentsIndex !== -1) {
        for (const row of data) {
          const comments = String(row[rawCommentsIndex] ?? '').split('$');
          for (const comment of comments) {
            const newRow = [...row];
            newRow[rawCommentsIndex] = comment.trim();
            expandedData.push(newRow);
          }
        }
      } else {
        expandedData.push(...data);
      }

      // 校验列名和顺序（确保后续可直接进入"标注后数据处理"）
      validateColumns(columns);

      const nextTableData: ProcessedTableData = {
        sourceFileName: file.name,
        columns,
        rows: expandedData
      };

      setTableData(nextTableData);
      setPage(1);

    } catch (err) {
      setError(`处理失败: ${err instanceof Error ? err.message : String(err)}`);
      setTableData(null);
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setError(null);
    setTableData(null);
    setPage(1);
    setTfHint(null);
  };

  const updateTf = (globalRowIndex: number, nextValue: string) => {
    const v = nextValue.trim();

    // 允许空、0、1
    if (v !== '' && v !== '0' && v !== '1') {
      setTfHint('tf 列仅支持输入 0 或 1');
      return;
    }

    setTfHint(null);
    setValidationError(null); // 用户修改时清除校验错误

    setTableData(prev => {
      if (!prev) return prev;
      if (tfColumnIndex < 0) return prev;

      const nextRows = prev.rows.slice();
      const row = nextRows[globalRowIndex];
      if (!row) return prev;

      const nextRow = row.slice();
      nextRow[tfColumnIndex] = v;
      nextRows[globalRowIndex] = nextRow;

      return { ...prev, rows: nextRows };
    });
  };

  const deleteRow = (globalRowIndex: number) => {
    setValidationError(null); // 删除行时清除校验错误
    setTableData(prev => {
      if (!prev) return prev;
      if (globalRowIndex < 0 || globalRowIndex >= prev.rows.length) return prev;
      const nextRows = prev.rows.slice();
      nextRows.splice(globalRowIndex, 1);
      return { ...prev, rows: nextRows };
    });
  };

  const validateTfColumn = () => {
    if (!tableData || tfColumnIndex < 0) {
      return { valid: false, message: '数据异常：未找到 tf 列' };
    }

    const emptyRows: number[] = [];
    
    for (let i = 0; i < tableData.rows.length; i++) {
      const row = tableData.rows[i];
      const tfValue = String(row[tfColumnIndex] || '').trim();
      
      // tf 必须是 0 或 1
      if (tfValue !== '0' && tfValue !== '1') {
        emptyRows.push(i + 1); // 行号从 1 开始
      }
    }

    if (emptyRows.length > 0) {
      const displayRows = emptyRows.slice(0, 10); // 最多显示前 10 行
      const moreCount = emptyRows.length - displayRows.length;
      let message = `以下行的 tf 列未填写或值不正确（必须为 0 或 1）：\n\n第 ${displayRows.join('、')} 行`;
      if (moreCount > 0) {
        message += `\n\n...还有 ${moreCount} 行未填写`;
      }
      return { valid: false, message };
    }

    return { valid: true, message: '' };
  };

  const handleGoToNext = () => {
    const validation = validateTfColumn();
    
    if (!validation.valid) {
      setValidationError(validation.message);
      // 滚动到错误提示位置
      setTimeout(() => {
        const errorEl = document.querySelector('.validation-error-message');
        if (errorEl) {
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    setValidationError(null);
    if (tableData && onGoToNext) {
      onGoToNext(tableData);
    }
  };

  return (
    <div className="processor-container">
      <div className="step-header">
        <h2 className="step-title">📄 第一步：原始数据处理</h2>
        <p className="step-description">
          上传 TXT 文件后，系统会自动处理并展示为可编辑表格。你可以在表格中填写 tf 值（0/1）并删除不需要的行。
        </p>
      </div>

      <div
        className={`upload-section-compact ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-compact-content">
          <div className="upload-icon-small">📁</div>
          <div className="upload-compact-text">
            <label htmlFor="raw-file-input" className="file-input-label-compact">
              选择 TXT 文件
            </label>
            <span className="upload-hint">或拖拽文件到此处</span>
          </div>
        </div>
        <input
          id="raw-file-input"
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          className="file-input"
        />
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

      {file && !processing && !tableData && (
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

      {tableData && (
        <div className="result-section">
          <h3 className="result-title">✅ 处理完成（可直接在页面内标注）</h3>

          <div className="result-info">
            <p><strong>源文件:</strong> {tableData.sourceFileName}</p>
            <p><strong>数据行数:</strong> {tableData.rows.length} 行</p>
            <p><strong>列数:</strong> {tableData.columns.length} 列</p>
          </div>

          <div className="table-actions">
            <div className="table-actions-left">
              <span className="table-badge">当前页：{page}/{totalPages}</span>
              <label className="table-label">
                每页显示
                <select
                  className="table-select"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={50}>50</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
                行
              </label>
            </div>

            <div className="table-actions-right">
              <button
                className="secondary-button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                上一页
              </button>
              <button
                className="secondary-button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                下一页
              </button>
            </div>
          </div>

          {tfHint && (
            <div className="hint-message">
              <strong>提示：</strong>{tfHint}
            </div>
          )}

          {validationError && (
            <div className="validation-error-message">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <div className="error-title">无法进入下一步</div>
                <div className="error-text">{validationError}</div>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-sticky-col">操作</th>
                  {tableData.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => {
                  const globalIndex = (page - 1) * pageSize + rowIndex;
                  return (
                    <tr key={globalIndex}>
                      <td className="table-sticky-col">
                        <button
                          className="row-delete-button"
                          onClick={() => deleteRow(globalIndex)}
                        >
                          删除
                        </button>
                      </td>
                      {tableData.columns.map((col, colIndex) => {
                        const cellValue = row[colIndex] ?? '';

                        if (col === 'tf') {
                          return (
                            <td key={`${globalIndex}-${col}`}>
                              <input
                                className="tf-input"
                                value={cellValue}
                                inputMode="numeric"
                                placeholder="0/1"
                                onChange={(e) => updateTf(globalIndex, e.target.value)}
                              />
                            </td>
                          );
                        }

                        return <td key={`${globalIndex}-${col}`}>{cellValue}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="action-buttons">
            <button
              className="primary-action-button"
              onClick={handleGoToNext}
              disabled={!tableData || !onGoToNext}
            >
              下一步：生成 CSV 文件 →
            </button>
            <button
              onClick={reset}
              className="secondary-action-button"
            >
              重新开始
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RawDataProcessor;
