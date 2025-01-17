const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "TemporaryTestSecret123";

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined.');
}

const generateWebSocketToken = (sessionId, documentId) => {
  console.log('***************');
  console.log('Debugging generateWebSocketToken');
  console.log('sessionId:', sessionId);
  console.log('documentId:', documentId);

  const payload = {
    sessionId,
    documentId,
  };

  const options = {
    expiresIn: '5m',
  };

  const token = jwt.sign(payload, JWT_SECRET, options);
  console.log('Generated token:', token);
  console.log('***************');

  return token;
};

const validateWebSocketToken = (token) => {
  console.log('***************');
  console.log('Debugging validateWebSocketToken');
  
  const cleanToken = token.split('/')[0];
  console.log('Cleaned token:', cleanToken);

  try {
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    console.log('Decoded payload:', decoded);
    return decoded;
  } catch (error) {
    console.error('Error during token validation:', error.message);
    console.log('***************');
    throw new Error('Token validation failed');
  }
};

module.exports = {
  generateWebSocketToken,
  validateWebSocketToken
};