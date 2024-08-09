// server.js
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Discord-Konfigurationswerte
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID;
const MECHANIC_ROLE_ID = process.env.MECHANIC_ROLE_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Route für die Startseite
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route für die Anmeldung mit Discord
app.get('/login', (req, res) => {
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(authUrl);
});

// Callback-Route nach erfolgreicher Authentifizierung
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.redirect('/');
    }

    try {
        // Token von Discord anfordern
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            scope: 'identify guilds'
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // Benutzerinformationen abrufen
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const userId = userResponse.data.id;

        // Gildeninformationen des Benutzers abrufen
        const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const userGuild = guildsResponse.data.find(guild => guild.id === GUILD_ID);
        
        if (userGuild) {
            // Überprüfen, ob der Benutzer die erforderliche Rolle hat
            const memberResponse = await axios.get(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`, {
                headers: {
                    'Authorization': `Bot ${BOT_TOKEN}` // Bot-Token aus den Umgebungsvariablen
                }
            });

            if (memberResponse.data.roles.includes(MECHANIC_ROLE_ID)) {
                // Erfolgreich authentifiziert
                res.cookie('token', accessToken, { httpOnly: true });
                console.log('Benutzer authentifiziert und Token gesetzt.');
                res.redirect('/calculator');
            } else {
                res.send('Du hast nicht die erforderliche Rolle, um auf den Rechner zuzugreifen.');
            }
        } else {
            res.send('Du bist nicht in der erforderlichen Gilde.');
        }
    } catch (error) {
        console.error('Fehler bei der Authentifizierung:', error.message);
        res.send('Fehler bei der Authentifizierung.');
    }
});

// Route für den Rechner (geschützt)
app.get('/calculator', (req, res) => {
    const token = req.cookies.token;

    if (token) {
        // Token-Überprüfung
        axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(() => {
            // Zeige den Rechner an, wenn die Token-Überprüfung erfolgreich ist
            res.sendFile(path.join(__dirname, 'public', 'calculator.html')); // Bitte sicherstellen, dass 'calculator.html' im 'public'-Verzeichnis vorhanden ist.
        }).catch(err => {
            console.error('Token-Überprüfung fehlgeschlagen:', err.message);
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
