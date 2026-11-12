import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';

const generateToken = (user: IUser): string => {
  const secret = process.env.JWT_SECRET || 'fadna_production_super_secret_jwt_key_2026';
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    secret,
    { expiresIn: '7d' }
  );
};

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, email, identifier, password } = req.body;
    let rawIdentifier = (username || email || identifier || '').trim();
    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username and password' });
    }

    // Strip leading @ if user typed @username
    if (rawIdentifier.startsWith('@')) {
      rawIdentifier = rawIdentifier.slice(1).trim();
    }

    const cleanIdentifier = rawIdentifier.toLowerCase();
    const escapedIdentifier = cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Search by username, email, or full name (case-insensitive)
    const user = await User.findOne({
      $or: [
        { username: cleanIdentifier },
        { email: cleanIdentifier },
        { username: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } },
        { email: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } },
        { name: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `Account not found for "${rawIdentifier}". Please check your username, email, or full name.`,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Admin.' });
    }

    // Check exact password or trimmed password
    let isMatch = await user.comparePassword(password);
    if (!isMatch && password.trim() !== password) {
      isMatch = await user.comparePassword(password.trim());
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please check your password or use 1-Click Role Access.',
      });
    }

    const token = generateToken(user);
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        customRole: user.customRole,
        department: user.department,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    return res.json({ success: true, user: req.user });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json({ success: true, count: users.length, users });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, username, email, password, role, department } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanUsername = (username || cleanEmail.split('@')[0] || '').toLowerCase().trim();

    if (!name || !cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, username, email, and password are required' });
    }

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'User with this username already exists' });
    }

    const newUser = new User({
      name,
      username: cleanUsername,
      email: cleanEmail,
      password,
      role: role || 'viewer',
      department: department || 'Production Floor',
    });

    await newUser.save();
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
