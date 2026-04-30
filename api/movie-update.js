const fs = require('fs');
const path = require('path');

// Set CORS headers
function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(request, response) {
  setCors(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'PUT' && request.method !== 'POST') {
    response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Faqat PUT/POST ishlaydi.' });
    return;
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const { id, title, genre, rating, quality, poster, description, year } = request.body;

    if (!id) {
      response.status(400).json({ ok: false, code: 'MISSING_ID', error: 'Kino ID si kerak.' });
      return;
    }

    // Read movies.json
    const moviesPath = path.join(process.cwd(), 'data', 'movies.json');
    const moviesData = fs.readFileSync(moviesPath, 'utf8');
    let movies = JSON.parse(moviesData);

    // Find movie index
    const movieIndex = movies.findIndex(m => m.id === parseInt(id) || m.id === id);
    
    if (movieIndex === -1) {
      response.status(404).json({ ok: false, code: 'MOVIE_NOT_FOUND', error: 'Kino topilmadi.' });
      return;
    }

    // Update movie fields
    const updatedMovie = { ...movies[movieIndex] };
    
    if (title !== undefined) updatedMovie.title = title;
    if (genre !== undefined) updatedMovie.genre = genre;
    if (rating !== undefined) updatedMovie.rating = parseFloat(rating);
    if (quality !== undefined) updatedMovie.quality = quality;
    if (poster !== undefined) updatedMovie.poster = poster;
    if (description !== undefined) updatedMovie.description = description;
    if (year !== undefined) updatedMovie.year = year;

    // Update in array
    movies[movieIndex] = updatedMovie;

    // Save back to file
    fs.writeFileSync(moviesPath, JSON.stringify(movies, null, 2), 'utf8');

    response.status(200).json({
      ok: true,
      message: 'Kino yangilandi!',
      movie: updatedMovie
    });

  } catch (error) {
    console.error('Update movie error:', error);
    response.status(500).json({
      ok: false,
      code: 'UPDATE_FAILED',
      error: error.message || 'Kino yangilashda xatolik.'
    });
  }
};
