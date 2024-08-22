import { writeFileSync, existsSync, mkdirSync } from 'fs';
import axios from 'axios';
import { join, dirname } from 'path';

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

      // Extract the path data from the SVG
      const pathMatch = svgData.match(/<path\s[^>]*d="([^"]*)"/);

      if (!pathMatch) {
        console.error(`No path found in the SVG file: ${fileName}`);
        continue;
      }

      const pathData = pathMatch[1];

      // Generate the React component code
      const reactComponent = `
import { IconProps } from './types';

export default function ${iconName}(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="arctic-icon-medium"
      aria-label="${ariaLabel}"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="${pathData}"
      />
    </svg>
  );
}`;

      // Determine the output directory
      const outputPath = join(
        process.cwd(),
        'src',
        'assets',
        'icons',
        `${iconName}.tsx`
      );

      // Ensure directory exists
      ensureDirectoryExistence(outputPath);

      // Save the file
      writeFileSync(outputPath, reactComponent.trim());
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
  const path = 'src/24/outline'; // Path within the repo

  // Fetch SVG file URLs using the GitHub API
  const svgUrls = await fetchGithubSvgUrls(repo, path);

  // Convert the SVG URLs to React components
  await convertSvgToReact(svgUrls);
}

processGithubSvgs();
