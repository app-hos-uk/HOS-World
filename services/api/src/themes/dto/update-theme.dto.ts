import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: {
    colors?: {
      primary?: string;
      secondary?: string;
      background?: string;
      surface?: string;
      text?: {
        primary?: string;
        secondary?: string;
      };
      accent?: string;
      error?: string;
      success?: string;
      warning?: string;
    };
    typography?: {
      fontFamily?: {
        primary?: string;
        secondary?: string;
      };
      fontSize?: {
        xs?: string;
        sm?: string;
        base?: string;
        lg?: string;
        xl?: string;
      };
    };
    spacing?: Record<string, string>;
    borderRadius?: Record<string, string>;
    shadows?: Record<string, string>;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
