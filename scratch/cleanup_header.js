const fs = require('fs');
const path = require('path');

// Basic .env parser fallback
try {
  const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
} catch (e) {
  console.warn('Could not load .env file');
}

const { listDriveMovies, updateCatalogMovieMetadata } = require('../api/_lib/google-drive');

async function cleanup() {
  try {
    console.log('Fetching movies from Google Drive...');
    const movies = await listDriveMovies();
    const targets = ['1WDGSR7CUR', '1U5D7LT4VJ'];
    
    let found = 0;
    for (const movie of movies) {
      if (targets.includes(movie.code)) {
        console.log(`Cleaning up movie: ${movie.title} (Code: ${movie.code}, ID: ${movie.id})`);
        await updateCatalogMovieMetadata(movie.id, { 
          showInHeader: false, 
          headerImage: "" 
        });
        found++;
      }
    }

    if (found === 0) {
      console.log('No movies found with the specified codes.');
      // Try by title fallback
      const titles = ["Mitchellar mashinalarga qarshi", "Lyusi | Lusi", "Lyusi"];
      for (const movie of movies) {
        if (titles.includes(movie.title)) {
           console.log(`Cleaning up movie by title: ${movie.title} (ID: ${movie.id})`);
           await updateCatalogMovieMetadata(movie.id, { 
             showInHeader: false, 
             headerImage: "" 
           });
           found++;
        }
      }
    }

    console.log(`Done. Cleaned up ${found} movies.`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

cleanup();
