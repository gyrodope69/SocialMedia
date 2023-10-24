const Post = require('../models/Post');
const User = require('../models/User');
const { sendEmail } = require('../middlewares/sendEmail');
const cloudinary = require('cloudinary');
const crypto = require('crypto');

exports.register = async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ success: false, message: 'User already exists' });
    }

    const myCloud = await cloudinary.v2.uploader.upload(avatar, {
      folder: 'avatars',
    });

    user = await User.create({
      name,
      email,
      password,
      avatar: { public_id: myCloud.public_id, url: myCloud.secure_url },
    });

    const token = await user.generateToken();
    res
      .status(201)
      .cookie('token', token, {
        expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      })
      .json({
        success: true,
        message: 'user registered succesfully',
        user,
        token,
      });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User doest exist',
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'invalid password',
      });
    }

    const token = await user.generateToken();
    res
      .status(200)
      .cookie('token', token, {
        expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      })
      .json({
        success: true,
        user,
        token,
      });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.logout = async (req, res) => {
  try {
    res
      .status(200)
      .cookie('token', null, { expires: new Date(Date.now()), httpOnly: true })
      .json({
        success: true,
        message: 'Logged out successfully',
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.followUser = async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    const loggedInUser = await User.findById(req.user._id);

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (loggedInUser.following.includes(userToFollow._id)) {
      const indexFollowing = loggedInUser.following.indexOf(userToFollow._id);
      const indexFollower = userToFollow.followers.indexOf(loggedInUser._id);
      loggedInUser.following.splice(indexFollowing, 1);
      userToFollow.followers.splice(indexFollower, 1);

      await loggedInUser.save();
      await userToFollow.save();

      return res.status(200).json({
        success: true,
        message: 'User Unfollowed',
      });
    } else {
      loggedInUser.following.push(userToFollow._id);
      userToFollow.followers.push(loggedInUser._id);

      await loggedInUser.save();
      await userToFollow.save();

      return res.status(200).json({
        success: true,
        message: 'User followed',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide oldPassword and newPassword',
      });
    }
    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect old password',
      });
    }
    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { name, email, avatar } = req.body;
    // if (!name || !email) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Please provide name and email',
    //   });
    // }
    if (name) {
      user.name = name;
    }
    if (email) {
      user.email = email;
    }
    // Avatar k liye bana na hai
    if (avatar) {
      await cloudinary.v2.uploader.destroy(user.avatar.public_id);

      const myCloud = await cloudinary.v2.uploader.upload(avatar, {
        folder: 'avatars',
      });
      user.avatar.public_id = myCloud.public_id;
      user.avatar.url = myCloud.secure_url;
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Profile updated',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const posts = user.posts;
    const followers = user.followers;
    const following = user.following;
    const userId = user._id;
    await user.deleteOne();
    // logout user
    res.cookie('token', null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    });

    for (let i = 0; i < posts.length; i++) {
      const post = await Post.findById(posts[i]);
      await post.deleteOne();
    }
    // Deleting following from followers following list
    for (let i = 0; i < followers.length; i++) {
      const follower = await User.findById(followers[i]);
      const index = follower.followers.indexOf(userId);
      follower.following.splice(index, 1);
      await follower.save();
    }

    for (let i = 0; i < following.length; i++) {
      const follows = await User.findById(following[i]);
      const index = follows.followers.indexOf(userId);
      follows.followers.splice(index, 1);
      await follows.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Profile deleted',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.myProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('posts');

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('posts');
    // console.log(user);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'user not found',
      });
    }
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email doesnt exsist',
      });
    }
    const resetPasswordToken = await user.getResetPasswordToken();
    console.log(resetPasswordToken);
    await user.save();

    const resetUrl = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/password/resetPassword/${resetPasswordToken}`;

    const message = `Reset your password by clicking on the link below: \n\n${resetUrl}`;
    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset Password',
        message,
      });
      res.status(200).json({
        success: true,
        message: `Email send to ${user.email}`,
      });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is expired',
      });
    }

    user.password = req.body.password;
    (user.resetPasswordToken = undefined),
      (user.resetPasswordExpire = undefined),
      await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
