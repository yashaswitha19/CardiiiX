
import React, { useState } from 'react';
import { Upload, FileText, Search, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ReportAnalyzer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setAnalysis(null);
    }
  };
const downloadReportPDF = async () => {
  const reportElement = document.getElementById('report-summary'); // The div containing the report
  
  if (!reportElement) {
    alert('Report not found');
    return;
  }

  try {
    // Show loading
    alert('Generating PDF...');

    // Capture the element as canvas
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297; // A4 height

    // Add multiple pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }

    // Download
    pdf.save('Medical_Report.pdf');
    alert('PDF downloaded successfully!');

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF');
  }
};



const analyzeFile = async () => {
  if (!previewUrl || !selectedFile) return;

  setIsAnalyzing(true);
  setAnalysis(null);

  try {
    const base64Data = previewUrl.split(',')[1];
    
    // Point to backend on port 5000
    const response = await fetch('http://localhost:5000/api/medical/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Data,
        mimeType: selectedFile.type
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.get('content-type'));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error:', errorText);
      throw new Error(`Server error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await response.text();
      console.error('Got HTML instead of JSON:', textResponse.substring(0, 200));
      throw new Error("Server returned HTML instead of JSON. Check backend URL.");
    }

    const result = await response.json();
    
    if (result.success && result.analysis) {
      setAnalysis(result.analysis);
    } else {
      setAnalysis("⚠️ Analysis completed but no results returned.");
    }
    
  } catch (error: any) {
    console.error("Full Analysis Error:", error);
    
    if (error.message.includes('Failed to fetch')) {
      setAnalysis("❌ Cannot connect to backend. Is it running on port 5000?");
    } else if (error.message.includes('HTML')) {
      setAnalysis("❌ Wrong URL - getting HTML instead of API response. Check console.");
    } else {
      setAnalysis(`❌ Error: ${error.message}`);
    }
  } finally {
    setIsAnalyzing(false);
  }
};






  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Upload Section */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[400px] text-center group hover:border-blue-400 transition-colors">
            {previewUrl ? (
              <div className="w-full h-full flex flex-col items-center">
                <img 
                  src={previewUrl} 
                  alt="Report Preview" 
                  className="max-h-[300px] w-auto rounded-xl shadow-lg mb-6 border border-slate-100" 
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => {setSelectedFile(null); setPreviewUrl(null); setAnalysis(null);}}
                    className="px-6 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                  >
                    Remove
                  </button>
                  <button 
                    onClick={analyzeFile}
                    disabled={isAnalyzing}
                    className="px-8 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                  >
                    {isAnalyzing ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Report'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Medical Report</h3>
                <p className="text-slate-500 mb-8 max-w-[280px]">
                  Upload a clear photo of your lab results, blood work, or doctor's note for AI interpretation.
                </p>
                <label className="cursor-pointer bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl">
                  Select File
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
                <p className="mt-4 text-xs text-slate-400">Supported: JPG, PNG, WEBP (Max 5MB)</p>
              </>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4">
            <AlertCircle size={24} className="text-blue-600 shrink-0" />
            <div>
              <h4 className="font-bold text-blue-900 mb-1 text-sm">How it works</h4>
              <p className="text-blue-800 text-xs leading-relaxed opacity-80">
                Our AI scans the image to identify medical terminology and values. It cross-references normal ranges to help you understand your data before your doctor's visit.
              </p>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[500px] overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                AI Analysis Results
              </h3>
              {analysis && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-widest bg-green-50 px-2 py-1 rounded">
                  <CheckCircle2 size={12} />
                  Ready
                </span>
              )}
            </div>

            <div className="flex-1 p-8">
              {!analysis && !isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="p-4 bg-slate-50 rounded-full">
                    <ImageIcon size={48} className="opacity-20" />
                  </div>
                  <p className="text-sm font-medium">Analyze a report to see insights here.</p>
                </div>
              ) : isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <Loader2 size={64} className="text-blue-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Search size={24} className="text-blue-300" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-lg font-bold text-slate-800">Processing Document</h4>
                    <p className="text-sm text-slate-500 animate-pulse">Running advanced OCR and clinical analysis...</p>
                  </div>
                </div>
              ) : (
                <div id="report-summary" className="prose prose-slate max-w-none bg-white p-6 rounded-lg">
  {analysis?.split('\n').map((line, i) => {
    if (line.startsWith('#')) return <h4 key={i} className="text-slate-900 font-bold mt-4 mb-2">{line.replace(/#/g, '')}</h4>;
    if (line.startsWith('*')) return <li key={i} className="text-slate-700 text-sm ml-4 mb-1">{line.replace(/\*/g, '').trim()}</li>;
    return <p key={i} className="text-slate-700 text-sm mb-3 leading-relaxed">{line}</p>;
  })}
</div>

              )}
            </div>
            
            {analysis && (
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
  className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-100 transition-colors text-sm"
  onClick={downloadReportPDF}
>
  Download Report Summary
</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportAnalyzer;
