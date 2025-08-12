import { NextResponse } from 'next/server';

interface WeatherData {
    location: string;
    temperature: number;
    feelsLike: number;
    windSpeed: number;
    windGust?: number;
    humidity: number;
    precipitation: number;
    visibility: number;
    conditions: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'EXTREME';
    impactAnalysis: {
        passingImpact: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
        runningImpact: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
        kickingImpact: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
        turnoverRisk: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
        scoringProjection: 'NORMAL' | 'SLIGHTLY_LOW' | 'LOW' | 'VERY_LOW';
        gameScript: 'NORMAL' | 'RUN_HEAVY' | 'CONSERVATIVE' | 'UNPREDICTABLE';
    };
    recommendations: {
        favorRBs: boolean;
        avoidWRs: boolean;
        avoidKickers: boolean;
        lowerProjections: boolean;
        increaseDefense: boolean;
    };
}

// NFL Stadium coordinates for weather lookup
const NFL_STADIUM_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
    'ARI': { lat: 33.5276, lon: -112.2626, city: 'Glendale' },
    'ATL': { lat: 33.7553, lon: -84.4006, city: 'Atlanta' },
    'BAL': { lat: 39.2780, lon: -76.6227, city: 'Baltimore' },
    'BUF': { lat: 42.7738, lon: -78.7870, city: 'Orchard Park' },
    'CAR': { lat: 35.2258, lon: -80.8528, city: 'Charlotte' },
    'CHI': { lat: 41.8623, lon: -87.6167, city: 'Chicago' },
    'CIN': { lat: 39.0955, lon: -84.5161, city: 'Cincinnati' },
    'CLE': { lat: 41.5061, lon: -81.6995, city: 'Cleveland' },
    'DAL': { lat: 32.7473, lon: -96.7995, city: 'Arlington' },
    'DEN': { lat: 39.7439, lon: -105.0201, city: 'Denver' },
    'DET': { lat: 42.3400, lon: -83.0456, city: 'Detroit' },
    'GB': { lat: 44.5013, lon: -88.0622, city: 'Green Bay' },
    'HOU': { lat: 29.6847, lon: -95.4107, city: 'Houston' },
    'IND': { lat: 39.7601, lon: -86.1639, city: 'Indianapolis' },
    'JAX': { lat: 30.3240, lon: -81.6374, city: 'Jacksonville' },
    'KC': { lat: 39.0489, lon: -94.4839, city: 'Kansas City' },
    'LV': { lat: 36.0909, lon: -115.1831, city: 'Las Vegas' },
    'LAC': { lat: 33.8641, lon: -118.2612, city: 'Inglewood' },
    'LAR': { lat: 33.8641, lon: -118.2612, city: 'Inglewood' },
    'MIA': { lat: 25.9580, lon: -80.2389, city: 'Miami Gardens' },
    'MIN': { lat: 44.9737, lon: -93.2581, city: 'Minneapolis' },
    'NE': { lat: 42.0909, lon: -71.2643, city: 'Foxborough' },
    'NO': { lat: 29.9511, lon: -90.0812, city: 'New Orleans' },
    'NYG': { lat: 40.8135, lon: -74.0745, city: 'East Rutherford' },
    'NYJ': { lat: 40.8135, lon: -74.0745, city: 'East Rutherford' },
    'PHI': { lat: 39.9008, lon: -75.1675, city: 'Philadelphia' },
    'PIT': { lat: 40.4468, lon: -80.0158, city: 'Pittsburgh' },
    'SF': { lat: 37.4032, lon: -121.9698, city: 'Santa Clara' },
    'SEA': { lat: 47.5952, lon: -122.3316, city: 'Seattle' },
    'TB': { lat: 27.9759, lon: -82.5033, city: 'Tampa' },
    'TEN': { lat: 36.1665, lon: -86.7713, city: 'Nashville' },
    'WAS': { lat: 38.9077, lon: -76.8645, city: 'Landover' }
};

function analyzeWeatherSeverity(weather: any): WeatherData['severity'] {
    const temp = weather.main.temp;
    const windSpeed = weather.wind?.speed || 0;
    const windGust = weather.wind?.gust || windSpeed;
    const precipitation = weather.rain?.['1h'] || weather.snow?.['1h'] || 0;
    const visibility = weather.visibility || 10000;

    // Extreme conditions (like 2013 Snow Bowl, 2017 Colts@Bills)
    if (windGust >= 25 || temp <= 10 || precipitation >= 5 || visibility <= 1000) {
        return 'EXTREME';
    }

    // Severe conditions (significantly impact gameplay)
    if (windGust >= 20 || temp <= 20 || precipitation >= 2 || visibility <= 3000) {
        return 'SEVERE';
    }

    // Moderate conditions (noticeable impact)
    if (windGust >= 15 || temp <= 32 || temp >= 90 || precipitation >= 0.5) {
        return 'MODERATE';
    }

    return 'MILD';
}

function analyzeGameImpact(weather: any, severity: WeatherData['severity']): WeatherData['impactAnalysis'] {
    const windSpeed = weather.wind?.speed || 0;
    const windGust = weather.wind?.gust || windSpeed;
    const temp = weather.main.temp;
    const precipitation = weather.rain?.['1h'] || weather.snow?.['1h'] || 0;

    let passingImpact: WeatherData['impactAnalysis']['passingImpact'] = 'NONE';
    let runningImpact: WeatherData['impactAnalysis']['runningImpact'] = 'NONE';
    let kickingImpact: WeatherData['impactAnalysis']['kickingImpact'] = 'NONE';
    let turnoverRisk: WeatherData['impactAnalysis']['turnoverRisk'] = 'NONE';
    let scoringProjection: WeatherData['impactAnalysis']['scoringProjection'] = 'NORMAL';
    let gameScript: WeatherData['impactAnalysis']['gameScript'] = 'NORMAL';

    // Wind impact (most critical for passing and kicking)
    if (windGust >= 25) {
        passingImpact = 'SEVERE';
        kickingImpact = 'SEVERE';
        scoringProjection = 'VERY_LOW';
        gameScript = 'RUN_HEAVY';
    } else if (windGust >= 20) {
        passingImpact = 'HIGH';
        kickingImpact = 'HIGH';
        scoringProjection = 'LOW';
        gameScript = 'RUN_HEAVY';
    } else if (windGust >= 15) {
        passingImpact = 'MODERATE';
        kickingImpact = 'MODERATE';
        scoringProjection = 'SLIGHTLY_LOW';
        gameScript = 'CONSERVATIVE';
    }

    // Temperature impact
    if (temp <= 10) {
        turnoverRisk = 'SEVERE';
        runningImpact = 'MODERATE';
        if (scoringProjection === 'NORMAL') scoringProjection = 'LOW';
    } else if (temp <= 20) {
        turnoverRisk = 'HIGH';
        runningImpact = 'LOW';
        if (scoringProjection === 'NORMAL') scoringProjection = 'SLIGHTLY_LOW';
    } else if (temp <= 32) {
        turnoverRisk = 'MODERATE';
    }

    // Precipitation impact
    if (precipitation >= 5) {
        turnoverRisk = 'SEVERE';
        passingImpact = passingImpact === 'NONE' ? 'HIGH' : passingImpact;
        runningImpact = runningImpact === 'NONE' ? 'MODERATE' : runningImpact;
        gameScript = 'RUN_HEAVY';
        scoringProjection = 'VERY_LOW';
    } else if (precipitation >= 2) {
        turnoverRisk = 'HIGH';
        passingImpact = passingImpact === 'NONE' ? 'MODERATE' : passingImpact;
        gameScript = 'CONSERVATIVE';
        if (scoringProjection === 'NORMAL') scoringProjection = 'LOW';
    } else if (precipitation >= 0.5) {
        turnoverRisk = 'MODERATE';
        if (scoringProjection === 'NORMAL') scoringProjection = 'SLIGHTLY_LOW';
    }

    return {
        passingImpact,
        runningImpact,
        kickingImpact,
        turnoverRisk,
        scoringProjection,
        gameScript
    };
}

function generateRecommendations(
    severity: WeatherData['severity'],
    impact: WeatherData['impactAnalysis']
): WeatherData['recommendations'] {
    return {
        favorRBs: impact.gameScript === 'RUN_HEAVY' || impact.passingImpact === 'SEVERE',
        avoidWRs: impact.passingImpact === 'HIGH' || impact.passingImpact === 'SEVERE',
        avoidKickers: impact.kickingImpact === 'HIGH' || impact.kickingImpact === 'SEVERE',
        lowerProjections: impact.scoringProjection !== 'NORMAL',
        increaseDefense: severity === 'SEVERE' || severity === 'EXTREME'
    };
}

// Teams that play in domed stadiums (weather doesn't matter)
const DOME_TEAMS = [
    'NO',   // New Orleans Saints
    'MIN',  // Minnesota Vikings  
    'LV',   // Las Vegas Raiders
    'LAC',  // Los Angeles Chargers
    'HOU',  // Houston Texans
    'ARI',  // Arizona Cardinals
    'ATL',  // Atlanta Falcons
    'DET',  // Detroit Lions
    'IND'   // Indianapolis Colts
];

function isGameInDome(team: string, opponent: string): boolean {
    return DOME_TEAMS.includes(team) || DOME_TEAMS.includes(opponent);
}

export async function GET(
    request: Request,
    { params }: { params: { location: string } }
) {
    try {
        const { location } = params;

        const apiKey = process.env.OPENWEATHER_API_KEY || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenWeather API key not configured' },
                { status: 500 }
            );
        }

        // Check if location is an NFL team code
        let coordinates;
        let cityName;

        if (NFL_STADIUM_COORDS[location.toUpperCase()]) {
            const stadium = NFL_STADIUM_COORDS[location.toUpperCase()];
            coordinates = { lat: stadium.lat, lon: stadium.lon };
            cityName = stadium.city;
        } else {
            // If not a team code, treat as city name
            cityName = location;
        }

        // Fetch current weather data from OpenWeatherMap
        let weatherUrl;
        if (coordinates) {
            weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${apiKey}&units=imperial`;
        } else {
            weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=imperial`;
        }

        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch weather data' },
                { status: weatherResponse.status }
            );
        }

        const weatherData = await weatherResponse.json();

        // Convert wind speed from m/s to mph if needed
        const windSpeedMph = weatherData.wind?.speed ? weatherData.wind.speed * 2.237 : 0;
        const windGustMph = weatherData.wind?.gust ? weatherData.wind.gust * 2.237 : windSpeedMph;

        // Analyze weather severity and impact
        const severity = analyzeWeatherSeverity({
            ...weatherData,
            wind: {
                speed: windSpeedMph,
                gust: windGustMph
            }
        });

        const impactAnalysis = analyzeGameImpact({
            ...weatherData,
            wind: {
                speed: windSpeedMph,
                gust: windGustMph
            }
        }, severity);

        const recommendations = generateRecommendations(severity, impactAnalysis);

        const result: WeatherData = {
            location: weatherData.name || cityName,
            temperature: Math.round(weatherData.main.temp),
            feelsLike: Math.round(weatherData.main.feels_like),
            windSpeed: Math.round(windSpeedMph),
            windGust: windGustMph > windSpeedMph ? Math.round(windGustMph) : undefined,
            humidity: weatherData.main.humidity,
            precipitation: weatherData.rain?.['1h'] || weatherData.snow?.['1h'] || 0,
            visibility: weatherData.visibility ? Math.round(weatherData.visibility * 0.000621371) : 10, // Convert m to miles
            conditions: weatherData.weather[0]?.description || 'Unknown',
            severity,
            impactAnalysis,
            recommendations
        };

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Weather API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}