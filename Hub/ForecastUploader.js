import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['csv', 'xls', 'xlsx'];

export default function ForecastUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [periods, setPeriods] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    // Handle rejections
    if (fileRejections.length > 0) {
      setFile(null);
      setError("Unsupported file type. Please upload a CSV or Excel file.");
      return;
    }

    if (acceptedFiles && acceptedFiles.length > 0) {
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
      const res = await fetch('/api/forecast', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results || []);
      } else {
        setError(data.error || 'Forecast failed.');
      }
    } catch (_) {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto p-4">
      <CardHeader>
        <CardTitle>Upload Sales Data & Forecast</CardTitle>
      </CardHeader>
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
                Drag & drop a <strong>CSV/Excel</strong> file here,
                <span className="underline text-indigo-600"> or click to select</span>
              </p>
            )}
            {file && <p className="mt-2 text-sm text-gray-700">Selected file: {file.name}</p>}
          </div>
          <div>
            <label className="block mb-1 font-medium">Forecast Periods (months):</label>
            <Input
              type="number"
              value={periods}
              min={1}
              onChange={(e) => setPeriods(Number(e.target.value))}
            />
          </div>
          {error && <p className="text-red-500 font-medium">{error}</p>}
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Forecasting...' : 'Run Forecast'}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="mt-6 space-y-4">
            {results.map((item) => (
              <Card key={item.parent_product_code} className="border">
                <CardHeader>
                  <CardTitle>Product: {item.parent_product_code}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm overflow-auto bg-gray-50 p-2 rounded">
                    {JSON.stringify(item.forecast, null, 2)}
                  </pre>
                  <div className="mt-2">
                    <strong>MAPE:</strong> {item.kpis.MAPE?.toFixed(2)}%<br />
                    <strong>Bias:</strong> {item.kpis.Bias?.toFixed(2)}<br />
                    <strong>RMSE:</strong> {item.kpis.RMSE?.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
