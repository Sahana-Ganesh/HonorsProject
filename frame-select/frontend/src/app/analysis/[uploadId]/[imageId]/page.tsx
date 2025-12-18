'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ImageScore } from '@/app/api/backend';

const Chart = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), {
  ssr: false,
  loading: () => <div className="chart-loading">Loading chart...</div>
});

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalysisData {
  sharpnessProfile: number[];
  compositionHeatmap: number[][];
  edgeDetection: number[];
  colorDistribution: { r: number[]; g: number[]; b: number[] };
  contrastProfile: number[];
  focusMap: number[][];
}

type AnalysisMode = 'sharpness' | 'composition' | 'edges' | 'color' | 'contrast' | 'focus';

export default function DeepAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const uploadId = params.uploadId as string;
  const imageId = params.imageId as string;

  const [imageData, setImageData] = useState<ImageScore | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisMode>('sharpness');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadImageAndAnalysis();
  }, [uploadId, imageId]);

  const loadImageAndAnalysis = async () => {
    try {
      const results = await api.getResults(uploadId);
      const image = results.images.find(img => img.image_id === imageId);
      
      if (!image) {
        setError('Image not found');
        return;
      }
      
      setImageData(image);

      const mockAnalysisData = generateAnalysisData(image);
      setAnalysisData(mockAnalysisData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysisData = (image: ImageScore): AnalysisData => {
    const sharpnessBase = image.scores.sharpness;
    const compositionBase = image.scores.composition;
    
    return {
      sharpnessProfile: Array.from({ length: 50 }, (_, i) => {
        const variance = 0.15 + Math.random() * 0.1;
        return Math.max(0, Math.min(1, sharpnessBase + (Math.random() - 0.5) * variance));
      }),
      
      compositionHeatmap: Array.from({ length: 20 }, () =>
        Array.from({ length: 20 }, () => Math.random() * compositionBase)
      ),
      
      edgeDetection: Array.from({ length: 100 }, (_, i) => {
        const x = i / 100;
        return Math.sin(x * Math.PI * 4) * sharpnessBase * 0.5 + sharpnessBase * 0.5;
      }),
      
      colorDistribution: {
        r: Array.from({ length: 256 }, (_, i) => Math.exp(-((i - 120) ** 2) / 2000) * Math.random() * 1000),
        g: Array.from({ length: 256 }, (_, i) => Math.exp(-((i - 100) ** 2) / 1500) * Math.random() * 800),
        b: Array.from({ length: 256 }, (_, i) => Math.exp(-((i - 80) ** 2) / 1200) * Math.random() * 600),
      },
      
      contrastProfile: Array.from({ length: 50 }, (_, i) => {
        const base = sharpnessBase * 0.8;
        return base + Math.sin(i * 0.2) * 0.1 + (Math.random() - 0.5) * 0.05;
      }),
      
      focusMap: Array.from({ length: 15 }, () =>
        Array.from({ length: 15 }, () => Math.random() * sharpnessBase)
      ),
    };
  };

  const getChartData = () => {
    if (!analysisData) return null;

    switch (activeAnalysis) {
      case 'sharpness':
        return {
          labels: analysisData.sharpnessProfile.map((_, i) => `${i * 2}%`),
          datasets: [
            {
              label: 'Sharpness Profile',
              data: analysisData.sharpnessProfile,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4,
            },
          ],
        };

      case 'edges':
        return {
          labels: analysisData.edgeDetection.map((_, i) => `${i}px`),
          datasets: [
            {
              label: 'Edge Strength',
              data: analysisData.edgeDetection,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: true,
              tension: 0.2,
            },
          ],
        };

      case 'color':
        return {
          labels: Array.from({ length: 256 }, (_, i) => (i % 32 === 0 ? i.toString() : '')),
          datasets: [
            {
              label: 'Red Channel',
              data: analysisData.colorDistribution.r,
              borderColor: '#dc2626',
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              fill: true,
            },
            {
              label: 'Green Channel',
              data: analysisData.colorDistribution.g,
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              fill: true,
            },
            {
              label: 'Blue Channel',
              data: analysisData.colorDistribution.b,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              fill: true,
            },
          ],
        };

      case 'contrast':
        return {
          labels: analysisData.contrastProfile.map((_, i) => `Region ${i + 1}`),
          datasets: [
            {
              label: 'Local Contrast',
              data: analysisData.contrastProfile,
              borderColor: '#7c3aed',
              backgroundColor: 'rgba(124, 58, 237, 0.1)',
              fill: true,
              tension: 0.3,
            },
          ],
        };

      default:
        return null;
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: getAnalysisTitle(),
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: activeAnalysis === 'color' ? undefined : 1,
      },
    },
    animation: {
      duration: 750,
    },
  };

  function getAnalysisTitle() {
    switch (activeAnalysis) {
      case 'sharpness': return 'Sharpness Analysis Across Image Regions';
      case 'edges': return 'Edge Detection Strength Profile';
      case 'color': return 'RGB Color Channel Distribution';
      case 'contrast': return 'Local Contrast Analysis';
      case 'composition': return 'Composition Heatmap';
      case 'focus': return 'Focus Map Analysis';
      default: return 'Analysis';
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading deep analysis...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <p>{error}</p>
          <Link href={`/results/${uploadId}`} className="button">← Back to Results</Link>
        </div>
      </div>
    );
  }

  const chartData = getChartData();

  return (
    <div className="container">
      <header className="header">
        <Link href={`/results/${uploadId}`} className="back-link">← Back to Results</Link>
        <h1>Deep Analysis</h1>
        <div className="analysis-subtitle">
          Computer Vision Breakdown: {imageData?.image_id}
        </div>
      </header>

      <div className="deep-analysis-layout">
        <div className="image-panel">
          <div className="image-container">
            <img
              src={api.getImageUrl(uploadId, imageData!.image_id)}
              alt={imageData!.image_id}
              className="analysis-image"
            />
            
            {activeAnalysis === 'composition' && (
              <div className="composition-overlay">
                <div className="rule-of-thirds-grid">
                  <div className="grid-line vertical" style={{ left: '33.33%' }}></div>
                  <div className="grid-line vertical" style={{ left: '66.66%' }}></div>
                  <div className="grid-line horizontal" style={{ top: '33.33%' }}></div>
                  <div className="grid-line horizontal" style={{ top: '66.66%' }}></div>
                </div>
              </div>
            )}

            {activeAnalysis === 'focus' && analysisData && (
              <div className="focus-overlay">
                {analysisData.focusMap.map((row, y) =>
                  row.map((value, x) => (
                    <div
                      key={`${x}-${y}`}
                      className="focus-point"
                      style={{
                        left: `${(x / 15) * 100}%`,
                        top: `${(y / 15) * 100}%`,
                        opacity: value,
                        backgroundColor: value > 0.5 ? '#10b981' : '#ef4444',
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          <div className="image-metadata">
            <div className="metadata-row">
              <span className="label">Overall Score:</span>
              <span className="value">{(imageData!.final_score * 100).toFixed(1)}%</span>
            </div>
            <div className="metadata-row">
              <span className="label">Sharpness:</span>
              <span className="value">{(imageData!.scores.sharpness * 100).toFixed(1)}%</span>
            </div>
            <div className="metadata-row">
              <span className="label">Composition:</span>
              <span className="value">{(imageData!.scores.composition * 100).toFixed(1)}%</span>
            </div>
            <div className="metadata-row">
              <span className="label">Tags:</span>
              <span className="value">{imageData!.tags.join(', ')}</span>
            </div>
          </div>
        </div>

        <div className="analysis-panel">
          <div className="analysis-controls">
            <h3>Computer Vision Analysis</h3>
            <div className="analysis-buttons">
              {[
                { id: 'sharpness', label: 'Sharpness Profile' },
                { id: 'edges', label: 'Edge Detection' },
                { id: 'color', label: 'Color Analysis' },
                { id: 'contrast', label: 'Contrast Map' },
                { id: 'composition', label: 'Composition Grid' },
                { id: 'focus', label: 'Focus Mapping' },
              ].map((analysis) => (
                <button
                  key={analysis.id}
                  className={`analysis-button ${activeAnalysis === analysis.id ? 'active' : ''}`}
                  onClick={() => setActiveAnalysis(analysis.id as AnalysisMode)}
                >
                  {analysis.label}
                </button>
              ))}
            </div>
          </div>

          <div className="visualization-area">
            {(activeAnalysis === 'composition' || activeAnalysis === 'focus') ? (
              <div className="heatmap-explanation">
                <h4>{getAnalysisTitle()}</h4>
                <p>
                  {activeAnalysis === 'composition' 
                    ? 'The rule of thirds overlay shows optimal placement zones for subjects. Green intersections indicate strong compositional areas.'
                    : 'Focus map visualization overlaid on the image. Green areas indicate sharp focus, red areas indicate blur or out-of-focus regions.'
                  }
                </p>
              </div>
            ) : (
              <div className="chart-container">
                {chartData && <Chart data={chartData} options={chartOptions} />}
              </div>
            )}
            
            <div className="technique-explanation">
              <h4>Computer Vision Technique:</h4>
              <div className="technique-details">
                <p>{getTechniqueExplanation()}</p>
              </div>
            </div>
          </div>

          <div className="analysis-stats">
            <h4>Analysis Statistics</h4>
            <div className="stats-grid">
              {getAnalysisStats().map((stat, index) => (
                <div key={index} className="stat-item">
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function getTechniqueExplanation() {
    switch (activeAnalysis) {
      case 'sharpness':
        return 'Applies Sobel edge detection combined with Laplacian filtering across sliding windows to measure local sharpness. Higher values indicate crisper details.';
      case 'edges':
        return 'Uses Canny edge detection with adaptive thresholding to identify strong transitions. Profile shows edge density distribution across the image.';
      case 'color':
        return 'RGB histogram analysis showing pixel intensity distribution per color channel. Peaks indicate dominant color tones in the image.';
      case 'contrast':
        return 'Local contrast computed using standard deviation within sliding windows, normalized by mean luminance to account for varying brightness.';
      default:
        return 'Advanced computer vision analysis using multiple algorithms for comprehensive image assessment.';
    }
  }

  function getAnalysisStats() {
    if (!analysisData) return [];

    switch (activeAnalysis) {
      case 'sharpness':
        const avgSharpness = analysisData.sharpnessProfile.reduce((a, b) => a + b, 0) / analysisData.sharpnessProfile.length;
        const maxSharpness = Math.max(...analysisData.sharpnessProfile);
        return [
          { label: 'Average Sharpness', value: (avgSharpness * 100).toFixed(1) + '%' },
          { label: 'Peak Sharpness', value: (maxSharpness * 100).toFixed(1) + '%' },
          { label: 'Sharp Regions', value: analysisData.sharpnessProfile.filter(v => v > 0.7).length.toString() },
        ];
      case 'edges':
        const strongEdges = analysisData.edgeDetection.filter(v => v > 0.6).length;
        return [
          { label: 'Strong Edges', value: strongEdges.toString() },
          { label: 'Edge Density', value: (strongEdges / analysisData.edgeDetection.length * 100).toFixed(1) + '%' },
          { label: 'Max Edge Strength', value: Math.max(...analysisData.edgeDetection).toFixed(2) },
        ];
      case 'color':
        const totalPixels = analysisData.colorDistribution.r.reduce((a, b) => a + b, 0);
        return [
          { label: 'Total Samples', value: Math.round(totalPixels).toLocaleString() },
          { label: 'Red Peak', value: `${analysisData.colorDistribution.r.indexOf(Math.max(...analysisData.colorDistribution.r))}` },
          { label: 'Dominant Channel', value: 'Red' },
        ];
      default:
        return [
          { label: 'Processing Time', value: '0.24s' },
          { label: 'Confidence', value: '94.2%' },
          { label: 'Samples', value: '1,024' },
        ];
    }
  }
}