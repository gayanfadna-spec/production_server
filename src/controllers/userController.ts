import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, IUser, UserRole } from '../models/User.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AuditService } from '../services/auditService.js';
import { AuditLog } from '../models/AuditLog.js';

export const getUsers = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { search, role, status, page = 1, limit = 50 } = req.query;
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { username: { $regex: String(search), $options: 'i' } },
        { email: { $regex: String(search), $options: 'i' } },
        { department: { $regex: String(search), $options: 'i' } },
      ];
    }

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Calculate role breakdown stats
    const [totalAll, activeCount, inactiveCount, adminCount, managerCount, storeCount, viewerCount, otherCount] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ role: 'production_manager' }),
        User.countDocuments({ role: 'store_keeper' }),
        User.countDocuments({ role: 'viewer' }),
        User.countDocuments({ role: { $in: ['other', 'others'] } }),
      ]);

    return res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      users,
      stats: {
        total: totalAll,
        active: activeCount,
        inactive: inactiveCount,
        admin: adminCount,
        productionManager: managerCount,
        storeKeeper: storeCount,
        viewer: viewerCount,
        other: otherCount,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const recentLogs = await AuditLog.find({ performedBy: user._id })
      .sort({ createdAt: -1 })
      .limit(15);

    return res.json({ success: true, user, recentLogs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, username, email, password, role, customRole, department, isActive = true } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, username, email, and password are required' });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    const usernameExists = await User.findOne({ username: cleanUsername });
    if (usernameExists) {
      return res.status(400).json({ success: false, message: 'A user with this username already exists' });
    }

    const emailExists = await User.findOne({ email: cleanEmail });
    if (emailExists) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }

    const editorName = req.user?.name || 'Administrator';

    const newUser = new User({
      name: name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password,
      role: role || 'viewer',
      customRole: customRole ? customRole.trim() : '',
      department: department || 'Production & Planning',
      isActive: Boolean(isActive),
      lastEditedBy: {
        userId: req.user?._id,
        userName: editorName,
        userEmail: req.user?.email || '',
        userRole: req.user?.role || 'admin',
        editedAt: new Date(),
        summary: `Account created by ${editorName}`,
      },
    });

    await newUser.save();

    // Record audit trail
    await AuditService.record({
      user: req.user,
      action: 'CREATE',
      entityType: 'User',
      entityId: newUser._id.toString(),
      entityName: `${newUser.name} (@${newUser.username} / ${newUser.email})`,
      summary: `Created new user account with role '${newUser.role}' in '${newUser.department}'`,
      changes: [
        { field: 'name', label: 'Name', oldValue: null, newValue: newUser.name },
        { field: 'username', label: 'Username', oldValue: null, newValue: newUser.username },
        { field: 'email', label: 'Email', oldValue: null, newValue: newUser.email },
        { field: 'role', label: 'Role', oldValue: null, newValue: newUser.role },
        { field: 'customRole', label: 'Custom Role', oldValue: null, newValue: newUser.customRole },
        { field: 'department', label: 'Department', oldValue: null, newValue: newUser.department },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        customRole: newUser.customRole,
        department: newUser.department,
        isActive: newUser.isActive,
        lastEditedBy: newUser.lastEditedBy,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, username, email, role, customRole, department, isActive, password } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check username uniqueness if username is changed
    if (username && username.toLowerCase().trim() !== user.username) {
      const cleanUsername = username.toLowerCase().trim();
      const usernameExists = await User.findOne({
        username: cleanUsername,
        _id: { $ne: user._id },
      });
      if (usernameExists) {
        return res.status(400).json({ success: false, message: 'Another user already uses this username' });
      }
    }

    // Check email uniqueness if email is changed
    if (email && email.toLowerCase().trim() !== user.email) {
      const emailExists = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: user._id },
      });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Another user already uses this email' });
      }
    }

    const updateFields: Record<string, any> = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (username !== undefined) updateFields.username = username.toLowerCase().trim();
    if (email !== undefined) updateFields.email = email.toLowerCase().trim();
    if (role !== undefined) updateFields.role = role;
    if (customRole !== undefined) updateFields.customRole = customRole.trim();
    if (department !== undefined) updateFields.department = department.trim();
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);

    const { changes, summary } = AuditService.diff(user.toObject(), updateFields);

    // Apply updates
    Object.assign(user, updateFields);

    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      changes.push({ field: 'password', label: 'Password', oldValue: '******', newValue: '[Password Reset]' });
    }

    const editorName = req.user?.name || 'Administrator';
    const finalSummary = changes.length > 0 ? summary : 'Updated profile';

    user.lastEditedBy = {
      userId: req.user?._id,
      userName: editorName,
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'admin',
      editedAt: new Date(),
      summary: finalSummary,
    };

    await user.save();

    if (changes.length > 0) {
      await AuditService.record({
        user: req.user,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user._id.toString(),
        entityName: `${user.name} (@${user.username || ''} / ${user.email})`,
        summary: finalSummary,
        changes,
      });
    }

    const userObj = user.toObject();
    delete userObj.password;

    return res.json({
      success: true,
      message: 'User updated successfully',
      user: userObj,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user && String(req.user._id) === String(user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    const previousStatus = user.isActive;
    user.isActive = !user.isActive;

    const editorName = req.user?.name || 'Administrator';
    const statusText = user.isActive ? 'Activated' : 'Deactivated';
    const summary = `${statusText} user account`;

    user.lastEditedBy = {
      userId: req.user?._id,
      userName: editorName,
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'admin',
      editedAt: new Date(),
      summary,
    };

    await user.save();

    await AuditService.record({
      user: req.user,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user._id.toString(),
      entityName: `${user.name} (${user.email})`,
      summary,
      changes: [
        {
          field: 'isActive',
          label: 'Active Status',
          oldValue: previousStatus,
          newValue: user.isActive,
        },
      ],
    });

    return res.json({
      success: true,
      message: `User successfully ${statusText.toLowerCase()}`,
      isActive: user.isActive,
      lastEditedBy: user.lastEditedBy,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user && String(req.user._id) === String(user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    // Soft delete by deactivating
    user.isActive = false;
    const editorName = req.user?.name || 'Administrator';
    user.lastEditedBy = {
      userId: req.user?._id,
      userName: editorName,
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'admin',
      editedAt: new Date(),
      summary: 'Deactivated & removed user account',
    };
    await user.save();

    await AuditService.record({
      user: req.user,
      action: 'DELETE',
      entityType: 'User',
      entityId: user._id.toString(),
      entityName: `${user.name} (${user.email})`,
      summary: `Deactivated user account`,
      changes: [{ field: 'isActive', label: 'Active Status', oldValue: true, newValue: false }],
    });

    return res.json({ success: true, message: 'User account deactivated' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
