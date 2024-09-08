import { writeFileSync, existsSync, mkdirSync } from 'fs';
import axios from 'axios';
import { join, dirname } from 'path';
import * as cheerio from 'cheerio';
import prettier from 'prettier';
import { optimize } from 'svgo'; // Import SVGO for SVG optimization

// Utility function to convert file name to PascalCase with 'Icon' suffix
function toPascalCase(str: string): string {
  return str.replace(/(^\w|-\w)/g, clearAndUpper).replace(/-/g, '') + 'Icon';
}

function clearAndUpper(text: string): string {
  return text.replace(/-/, '').toUpperCase();
}

// Function to extract the base file name without extension
function getFileNameFromUrl(url: string): string {
  const fileName = url.substring(url.lastIndexOf('/') + 1, url.length);
  return fileName.replace('.svg', '');
}

// Ensure directory exists or create it
function ensureDirectoryExistence(filePath: string): boolean {
  const dir = dirname(filePath);
  if (existsSync(dir)) {
    return true;
  }
  mkdirSync(dir, { recursive: true });
  return false;
}

// Function to convert SVG URL array to React component
async function convertSvgToReact(urls: string[]): Promise<void> {
  console.log(`Processing ${urls.length} SVG files...`);

  for (const url of urls) {
    try {
      console.log(`Fetching SVG from: ${url}`);

      // Extract the file name and generate the icon name
      const fileName = getFileNameFromUrl(url);
      const iconName = toPascalCase(fileName);
      const ariaLabel = fileName;

      // Fetch the SVG file
      const response = await axios.get<string>(url);
      const svgData = response.data;

      // Optimize and transform SVG to JSX-compatible attributes using SVGO
      const optimizedSvg = optimize(svgData, {
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false, // Keep viewBox attribute
                cleanupIds: false,
              },
            },
          },
          {
            name: 'convertStyleToAttrs', // Convert inline styles to attributes
          },
          {
            name: 'convertColors', // Convert colors to hex or rgb
          },
          {
            name: 'convertTransform', // Convert transforms to matrix or attribute
          },
        ],
      });

      const $ = cheerio.load(optimizedSvg.data, { xmlMode: true });
      const svgElements = $('svg').html(); // Extract all content within the <svg> tag

      // Generate the React component code
      const reactComponent = `
import { IconProps } from './types';

export default function ${iconName}(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      className="arctic-icon-medium solid"
      aria-label="${ariaLabel}"
      {...props}
    >
      ${svgElements}
    </svg>
  );
}`;

      // Use prettier to format the generated code
      const formattedCode = prettier.format(reactComponent, {
        parser: 'babel-ts',
      });

      // Determine the output directory
      const outputPath = join(process.cwd(), 'src', 'icons', `${iconName}.tsx`);

      // Ensure directory exists
      ensureDirectoryExistence(outputPath);

      // Save the formatted file
      writeFileSync(outputPath, formattedCode);
      console.log(`React component saved as ${iconName}.tsx`);
    } catch (error) {
      console.error(`Error fetching or processing the SVG for ${url}:`, error);
    }
  }
}

// Function to fetch SVG file URLs using the GitHub API
async function fetchGithubSvgUrls(
  repo: string,
  path: string
): Promise<string[]> {
  const githubApiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  try {
    const response = await axios.get(githubApiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const files = response.data;
    const svgUrls: string[] = [];

    files.forEach((file: { name: string; download_url: string }) => {
      if (file.name.endsWith('.svg')) {
        svgUrls.push(file.download_url);
      }
    });

    console.log(`Total SVG files found: ${svgUrls.length}`);
    return svgUrls;
  } catch (error) {
    console.error('Error fetching GitHub directory contents:', error);
    return [];
  }
}

// Example usage:
async function processGithubSvgs() {
  const repo = 'tailwindlabs/heroicons'; // GitHub repo in format 'owner/repo'
  const path = 'src/24/solid'; // Path within the repo

  // Fetch SVG file URLs using the GitHub API
  const svgUrls = await fetchGithubSvgUrls(repo, path);

  // Convert the SVG URLs to React components
  await convertSvgToReact(svgUrls);
}

processGithubSvgs();
