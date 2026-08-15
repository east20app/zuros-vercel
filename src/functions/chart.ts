import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { Chart, registerables } from "chart.js";
import path from "path";

GlobalFonts.registerFromPath(path.resolve(process.cwd(), './fonts/DejaVuSans.ttf'), 'DejaVu Sans');

Chart.register(...registerables);

Chart.defaults.font.size = 14;
Chart.defaults.font.family = 'DejaVu Sans';

export enum ChartType {
    LINE = "line",
    BAR = "bar",
    RADAR = "radar",
    DOUGHNUT = "doughnut",
    POLAR_AREA = "polarArea",
    PIE = "pie",
    BUBBLE = "bubble",
    SCATTER = "scatter",
}

export enum ChartColor {
    RED = "rgb(255, 99, 132)",
    ORANGE = "rgb(255, 159, 64)",
    YELLOW = "rgb(255, 205, 86)",
    GREEN = "rgb(75, 192, 192)",
    BLUE = "rgb(54, 162, 235)",
    PURPLE = "rgb(153, 102, 255)",
    GREY = "rgb(201, 203, 207)",
    TRANSPARENT = "transparent",
}

interface ChartData {
    labels: string[];
    values: number[];
    type?: ChartType;
    width?: number;
    height?: number;
    prefix?: string;
    chartColor?: ChartColor | string;
    backgroundColor?: ChartColor | string;
    borderRadius?: number;
    borderColor?: ChartColor | string;
}

/**
 * BUG CORRIGIDO: `currentChartInstance` era uma variável de MÓDULO
 * (compartilhada entre todas as chamadas). Se `generateChartBuffer` for
 * chamado concorrentemente (ex: vários usuários pedindo gráfico ao mesmo
 * tempo), as chamadas pisavam na variável umas das outras — race condition.
 * Além disso, a instância do Chart.js nunca era destruída (`.destroy()`),
 * o que deixa handlers/plugins presos na memória a cada gráfico gerado.
 * Agora a instância é 100% local à função e é destruída no final.
 */
export async function generateChartBuffer(data: ChartData): Promise<Buffer> {

  const canvas = createCanvas(data.width || 440, data.height || 250);
  const ctx = canvas.getContext('2d') as any

  const plugin = {
    id: 'customCanvasBackgroundColor',

    beforeDraw: (chart: any) => {
      const { ctx } = chart;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = data.backgroundColor || ChartColor.TRANSPARENT;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    }
  };

  const chartInstance = new Chart(ctx, {
      type: data.type || ChartType.LINE,
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          borderWidth: 1,
          borderColor: data.borderColor || undefined,
          borderRadius: data.borderRadius || 0,
          backgroundColor: data.chartColor || undefined,
        }]
      },
      options: {
        plugins: {
          title: {
            text: "@CamposCloud - All Rights Reserved",
            display: true,
            align: "end",
            color: "rgba(255,255,255,0.2)",
            font: {
              size: 12,
              weight: "normal",
              family: "DejaVu Sans",
            },
          },
          legend: {
            display: false,
          },
        },

        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value, index, values) {
                    const valueWithPrefix = data.prefix ? data.prefix + value : value;
                    return valueWithPrefix;
                  },
                  font: {
                    size: 12,
                    family: "DejaVu Sans",
                  }
              }
            },
            x: {
              ticks: {
                font: {
                  size: 11,
                  family: "DejaVu Sans",
                }
              }
            }
        },
      },
      plugins: [plugin],
  });

  try {
    return canvas.toBuffer("image/png");
  } finally {
    chartInstance.destroy();
  }
}