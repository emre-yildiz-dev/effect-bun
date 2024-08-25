import { Effect, Schedule, Duration, pipe, Cache } from "effect"

interface WeatherData {
    temperature: number
    humidity: number
    windSpeed: number
}

class NetworkError extends Error {
    readonly _tag = "NetworkError"
}

class ApiError extends Error {
    readonly _tag = "ApiError"
    constructor(public statusCode: number, message: string) {
        super(message)
    }
}

const fetchWeatherData = (city: string): Effect.Effect<WeatherData, NetworkError | ApiError, never> =>
    Effect.tryPromise({
        try: async () => {
            const response = await fetch(`http://localhost:4000/weather?city=${city}`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.type}`)
            }
            return response.json() as Promise<WeatherData>
        },
        catch: (error) => {
            if (error instanceof Error) {
                if (error.message) {
                    return new ApiError(1001, error.message)
                }
                return new NetworkError(error.message)
            }
            console.error(error)
            return new NetworkError("Unknown error occurred")
        }
    })

const resilientFetchWeatherData = (city: string) =>
    pipe(
        fetchWeatherData(city),
        Effect.retry(
            pipe(
                Schedule.exponential(Duration.seconds(1)),
                Schedule.intersect(Schedule.recurs(3)),
                Schedule.tapInput((attempt) => Effect.sync(() => console.log(`Retry attempt: ${attempt}`)))
            )
        ),
        Effect.timeout(Duration.seconds(10)),
        Effect.catchTag("TimeoutException", () => Effect.fail(new Error("Request timed out")))
    );

const getWeatherReport = (city: string) =>
    pipe(
        resilientFetchWeatherData(city),
        Effect.map((data) => `The temperature in ${city} is ${data.temperature}°C with ${data.humidity}% humidity and ${data.windSpeed}m/s wind speed.`),
        Effect.catchAll((error) => {
            if (error instanceof ApiError) {
                return Effect.succeed(`Failed to fetch weather data: ${error.message}`)
            }
            if (error instanceof NetworkError) {
                return Effect.succeed(`Failed to fetch weather data: ${error.message}`)
            }
            return Effect.succeed(`Failed to fetch weather data: ${error.message}`)
        }),
    )

// Effect.runPromise(getWeatherReport("London")).then(console.log).catch(console.error)


// Create a cache for weather data
const weatherCache = Cache.make<string, WeatherData, NetworkError | ApiError>({
    capacity: 100,
    timeToLive: Duration.minutes(15),
    lookup: (city: string) => Effect.catchAll(
        resilientFetchWeatherData(city),
        (error) => {
            if (error instanceof ApiError || error instanceof NetworkError) {
                return Effect.fail(error);
            }
            return Effect.fail(new NetworkError(error.message));
        }
    )
});

  // Function to get weather data with caching
  const getCachedWeatherData = (city: string) =>
    pipe(
      Effect.flatMap(weatherCache, (cache) =>
        pipe(
          cache.get(city),
          Effect.catchAll((error) =>
            pipe(
              resilientFetchWeatherData(city),
              Effect.tap((data) => cache.set(city, data))
            )
            )
        )
    ))


// Function to get weather reports for multiple cities in parallel
const getMultiCityWeatherReport = (cities: string[]) =>
    pipe(
        Effect.forEach(
            cities,
            (city) =>
                pipe(
                    getCachedWeatherData(city),
                    Effect.map((data) => `${city}: ${data.temperature}°C`),
                    Effect.catchAll((error) => Effect.succeed(`${city}: Error fetching data`))
                ),
            { concurrency: "unbounded" }
        ),
        Effect.map((reports) => reports.join(", "))
    );

// Usage example
const cities = ["London", "New York", "Tokyo", "Sydney", "Paris"];
Effect.runPromise(getMultiCityWeatherReport(cities)).then(console.log);