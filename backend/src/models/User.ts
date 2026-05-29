import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class User extends Model {
  public id!: number;
  public username!: string;
  public email!: string;
  public password_hash!: string;
  public money!: number;
  public level!: number;
  public experience!: number;
  public points!: number;
  public strength!: number;
  public defense!: number;
  public speed!: number;
  public dexterity!: number;
  public energy!: number;
  public max_energy!: number;
  public nerve!: number;
  public max_nerve!: number;
  public life!: number;
  public max_life!: number;
  public happiness!: number;
  public status!: string;
  public last_action!: Date;
  public created_at!: Date;
  public updated_at!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    money: {
      type: DataTypes.BIGINT,
      defaultValue: 750,
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    experience: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    strength: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
    },
    defense: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
    },
    speed: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
    },
    dexterity: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
    },
    energy: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    max_energy: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    nerve: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
    },
    max_nerve: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
    },
    life: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    max_life: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    happiness: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'okay',
    },
    last_action: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    underscored: true,
  }
);

export default User;
