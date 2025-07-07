import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['csv', 'xls', 'xlsx'];
const PAGE_SIZE = 5;

export default function ForecastUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [periods, setPeriods] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageIndices, setPageIndices] = useState<Record<string, number>>({});

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      setFile(null);
      setError("Unsupported file type. Please upload a CSV or Excel file.");
      return;
    }
    if (acceptedFiles.length > 0) {
      const selected = acceptedFiles[0];
      const ext = selected.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setFile(null);
        setError("Invalid file extension. Accepted: .csv, .xls, .xlsx");
      } else {
        setFile(selected);
        setError(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    }
  });

  const handleSubmit = async () => {
    if (!file) {
      setError("Please select or drag a file.");
      return;
    }
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("periods", periods.toString());

    try {
      const res = await fetch('/api/forecast', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results || []);
        setPageIndices({});
      } else {
        setError(data.error || 'Forecast failed.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (code: string, forecast: any[]) => {
    const header = ['date', 'forecast'];
    const rows = forecast.map((f: any) => [f.ds, f.yhat]);
    const csvContent = [header, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code}_forecast.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPageChange = (code: string, delta: number) => {
    setPageIndices(prev => {
      const current = prev[code] || 0;
      const total = Math.ceil((results.find(r => r.parent_product_code === code)?.forecast.length || 0) / PAGE_SIZE);
      const next = Math.min(Math.max(current + delta, 0), total - 1);
      return { ...prev, [code]: next };
    });
  };

  return (
    <Card className="max-w-2xl mx-auto p-4">
      <CardHeader><CardTitle>Upload Sales Data & Forecast</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 ease-in-out ${
              isDragActive
                ? 'border-4 border-indigo-500 bg-indigo-100 animate-pulse'
                : 'border-gray-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="text-indigo-700 font-semibold text-lg">Drop the file here to forecast</p>
            ) : (
              <p className="text-gray-500 text-base">
                Drag & drop a <strong>CSV/Excel</strong> file here,{' '}
                <span className="underline text-indigo-600">or click to select</span>
              </p>
            )}
          </div>
          {file && <div className="text-center text-sm text-gray-700">Selected file: <span className="font-medium">{file.name}</span></div>}
          <div>
            <label className="block mb-1 font-medium">Forecast Periods (months):</label>
            <Input type="number" value={periods} min={1} onChange={e => setPeriods(Number(e.target.value))} />
          </div>
          {error && <p className="text-red-500 font-medium">{error}</p>}
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Forecasting...' : 'Run Forecast'}</Button>
        </div>

        {results.length > 0 && (
          <div className="mt-6 space-y-6">
            {results.map(item => {
              const { parent_product_code: code, forecast, kpis } = item;
              const page = pageIndices[code] || 0;
              const paged = forecast.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
              const totalPages = Math.ceil(forecast.length / PAGE_SIZE);

              return (
                <Card key={code} className="border">
                  <CardHeader className="flex justify-between items-center">
                    <CardTitle>Product: {code}</CardTitle>
                    <Button size="sm" onClick={() => downloadCSV(code, forecast)}>Download CSV</Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr>
                            <th className="px-2 py-1">Date</th>
                            <th className="px-2 py-1">Forecast</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((f: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-2 py-1">{f.ds}</td>
                              <td className="px-2 py-1">{f.yhat.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <div>
                        <Button size="sm" onClick={() => onPageChange(code, -1)} disabled={page === 0}>Prev</Button>
                        <span className="mx-2">{page + 1} / {totalPages}</span>
                        <Button size="sm" onClick={() => onPageChange(code, 1)} disabled={page + 1 === totalPages}>Next</Button>
                      </div>
                      <div className="mt-2">
                        <strong>MAPE:</strong> {kpis.MAPE?.toFixed(2)}% &nbsp;
                        <strong>Bias:</strong> {kpis.Bias?.toFixed(2)} &nbsp;
                        <strong>RMSE:</strong> {kpis.RMSE?.toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

