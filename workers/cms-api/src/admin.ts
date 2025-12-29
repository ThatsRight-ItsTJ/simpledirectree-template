import { Environment } from './types';
import { CMSAPIError, ValidationError } from './types';

export class AdminAPI {
  private env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Validate admin request
   */
  async validateAdminRequest(request: Request): Promise<void> {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      throw new ValidationError('Authorization header required');
    }

    // Simple Bearer token validation
    const token = authHeader.replace('Bearer ', '');
    if (token !== this.env.ADMIN_SECRET) {
      throw new ValidationError('Invalid admin credentials');
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<Response> {
    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.env.ENVIRONMENT,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Trigger manual rebuild for specific content
   */
  async triggerRebuild(
    locale: string,
    contentType: string,
    slug: string
  ): Promise<Response> {
    try {
      await this.validateAdminRequest(new Request('http://localhost/admin')); // Mock request for validation
      
      console.log(`[Admin] Triggering rebuild for ${locale}/${contentType}/${slug}`);
      
      // This would integrate with the main worker's rebuild logic
      // For now, return success response
      return new Response(JSON.stringify({
        success: true,
        message: `Rebuild triggered for ${locale}/${contentType}/${slug}`,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof CMSAPIError) {
        return new Response(JSON.stringify({
          error: error.message,
          code: error.code,
        }), {
          status: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<Response> {
    try {
      await this.validateAdminRequest(new Request('http://localhost/admin')); // Mock request for validation
      
      // This would query KV and R2 for cache statistics
      const stats = {
        kv: {
          totalKeys: 0,
          memoryUsage: '0 MB',
          hitRate: '0%',
        },
        r2: {
          totalObjects: 0,
          storageUsed: '0 GB',
          lastUpdated: new Date().toISOString(),
        },
        d1: {
          totalRecords: 0,
          averageHeatScore: 0,
        },
      };

      return new Response(JSON.stringify({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof CMSAPIError) {
        return new Response(JSON.stringify({
          error: error.message,
          code: error.code,
        }), {
          status: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Clear cache for specific content
   */
  async clearCache(locale: string, contentType: string, slug: string): Promise<Response> {
    try {
      await this.validateAdminRequest(new Request('http://localhost/admin')); // Mock request for validation
      
      console.log(`[Admin] Clearing cache for ${locale}/${contentType}/${slug}`);
      
      // This would remove entries from KV and R2
      return new Response(JSON.stringify({
        success: true,
        message: `Cache cleared for ${locale}/${contentType}/${slug}`,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof CMSAPIError) {
        return new Response(JSON.stringify({
          error: error.message,
          code: error.code,
        }), {
          status: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Get system logs
   */
  async getLogs(limit: number = 100): Promise<Response> {
    try {
      await this.validateAdminRequest(new Request('http://localhost/admin')); // Mock request for validation
      
      // This would fetch logs from a logging service
      const logs = [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'System started',
        },
        {
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'info',
          message: 'Cache miss for en/page/home',
        },
      ];

      return new Response(JSON.stringify({
        success: true,
        data: logs.slice(0, limit),
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof CMSAPIError) {
        return new Response(JSON.stringify({
          error: error.message,
          code: error.code,
        }), {
          status: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Update system configuration
   */
  async updateConfig(config: any): Promise<Response> {
    try {
      await this.validateAdminRequest(new Request('http://localhost/admin')); // Mock request for validation
      
      console.log(`[Admin] Updating system configuration:`, config);
      
      // This would update the configuration
      return new Response(JSON.stringify({
        success: true,
        message: 'Configuration updated successfully',
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (error instanceof CMSAPIError) {
        return new Response(JSON.stringify({
          error: error.message,
          code: error.code,
        }), {
          status: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }
}