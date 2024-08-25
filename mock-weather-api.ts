import { serve } from "bun";

// Function to generate random weather data
function generateWeatherData(): string {
  const data = {
    temperature: Math.round(Math.random() * 40 - 10), // -10 to 30°C
    humidity: Math.round(Math.random() * 100), // 0 to 100%
    windSpeed: Math.round(Math.random() * 50), // 0 to 50 km/h
  };
  return JSON.stringify(data);
}

// Object to store weather data for cities
const cityWeather: { [key: string]: string } = {};

const server = serve({
  port: 4000,
  fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === "/") {
      return new Response("Welcome to the Weather API!");
    }
    
    if (url.pathname === "/weather") {
      // 30% chance of returning an error
      if (Math.random() < 0.5) {
        return new Response("Internal Server Error", { status: 500 });
      }

      const city = url.searchParams.get("city");
      
      if (!city) {
        return new Response("Please provide a city parameter", { status: 400 });
      }
      
      if (!cityWeather[city]) {
        cityWeather[city] = generateWeatherData();
      }
      
      return new Response(cityWeather[city], {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response("404 Not Found", { status: 404 });
  },
});

console.log(`Server running on http://localhost:${server.port}`);