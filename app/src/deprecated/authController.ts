/**
 * authController.ts
 * 
 * Handles API requests related to authentication, such as user login.
 */

import { Request, Response } from 'express';
import AuthService from './authService';
//import DriveFileManager from '../services/DriveFileManager';
//import { ShareSettings } from '../services/driveShareService';

/**
 * AuthController
 * 
 * Contains methods to handle authentication-related HTTP requests.
 */
class AuthController {
  /**
   * Handles user login via Google OAuth token.
   * 
   * @param req - Express Request object containing the Google OAuth token.
   * @param res - Express Response object to send back the JWT and user details.
   */
  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ status: 'error', message: 'Token is required.' });
        return;
      }

      // Validate the Google OAuth token
      const googleUserData = await AuthService.validateToken(token);
      if (!googleUserData) {
        res.status(401).json({ status: 'error', message: 'Invalid token.' });
        return;
      }

      // Retrieve or create the user
      const user = await AuthService.retrieveUser(googleUserData);

      // Generate JWT
      const jwtToken = AuthService.generateJWT(user);

      res.status(200).json({
        status: 'success',
        token: jwtToken,
        user: {
          email: user.email,
          accountType: user.accountType,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
  }
  /**
  public async saveFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileName, content, folderId } = req.body;
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (!accessToken) {
        res.status(401).json({ status: 'error', message: 'No access token provided' });
        return;
      }

      await DriveFileManager.initialize(accessToken);
      const fileId = await DriveFileManager.saveToGoogleDrive(fileName, Buffer.from(content), folderId);

      res.status(200).json({
        status: 'success',
        fileId,
      });
    } catch (error) {
      console.error('Save file error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to save file' });
    }
  }

  public async loadFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (!accessToken) {
        res.status(401).json({ status: 'error', message: 'No access token provided' });
        return;
      }

      await DriveFileManager.initialize(accessToken);
      const content = await DriveFileManager.loadFromGoogleDrive(fileId);

      res.status(200).json({
        status: 'success',
        content: content.toString('base64'),
      });
    } catch (error) {
      console.error('Load file error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to load file' });
    }
  }

  public async listFiles(req: Request, res: Response): Promise<void> {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (!accessToken) {
        res.status(401).json({ status: 'error', message: 'No access token provided' });
        return;
      }

      await DriveFileManager.initialize(accessToken);
      const files = await DriveFileManager.listDriveFiles();

      res.status(200).json({
        status: 'success',
        files,
      });
    } catch (error) {
      console.error('List files error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to list files' });
    }
  }

  public async shareFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId, settings } = req.body;
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (!accessToken) {
        res.status(401).json({ status: 'error', message: 'No access token provided' });
        return;
      }

      await DriveFileManager.initialize(accessToken);
      await DriveFileManager.shareFile(fileId, settings as ShareSettings);

      res.status(200).json({
        status: 'success',
        message: 'File shared successfully',
      });
    } catch (error) {
      console.error('Share file error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to share file' });
    }
  }

  public async updateFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId, content } = req.body;
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (!accessToken) {
        res.status(401).json({ status: 'error', message: 'No access token provided' });
        return;
      }

      await DriveFileManager.initialize(accessToken);
      await DriveFileManager.updateFile(fileId, Buffer.from(content));

      res.status(200).json({
        status: 'success',
        message: 'File updated successfully',
      });
    } catch (error) {
      console.error('Update file error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to update file' });
    }
  }

 */
}



export default new AuthController();
