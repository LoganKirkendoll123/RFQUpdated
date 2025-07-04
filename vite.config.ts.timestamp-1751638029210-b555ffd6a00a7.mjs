// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/project44-oauth": {
        target: "https://na12.api.project44.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/project44-oauth/, ""),
        headers: {
          "Host": "na12.api.project44.com"
        },
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.removeHeader("origin");
          });
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error for /api/project44-oauth:", err.message);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Proxy error occurred" }));
            }
          });
        }
      },
      "/api/project44": {
        target: "https://na12.api.project44.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/project44/, ""),
        headers: {
          "Host": "na12.api.project44.com"
        },
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.removeHeader("origin");
          });
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error for /api/project44:", err.message);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Proxy error occurred" }));
            }
          });
        }
      },
      "/api/freshx": {
        target: "https://api.getfreshx.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/freshx/, ""),
        headers: {
          "Host": "api.getfreshx.com"
        },
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.removeHeader("origin");
          });
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error for /api/freshx:", err.message);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Proxy error occurred" }));
            }
          });
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICBzZXJ2ZXI6IHtcbiAgICBwcm94eToge1xuICAgICAgJy9hcGkvcHJvamVjdDQ0LW9hdXRoJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL25hMTIuYXBpLnByb2plY3Q0NC5jb20nLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL3Byb2plY3Q0NC1vYXV0aC8sICcnKSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdIb3N0JzogJ25hMTIuYXBpLnByb2plY3Q0NC5jb20nXG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5LCBfb3B0aW9ucykgPT4ge1xuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgX3JlcSwgX3JlcykgPT4ge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIE9yaWdpbiBoZWFkZXIgdG8gYnlwYXNzIENPUlMgcmVzdHJpY3Rpb25zXG4gICAgICAgICAgICBwcm94eVJlcS5yZW1vdmVIZWFkZXIoJ29yaWdpbicpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignUHJveHkgZXJyb3IgZm9yIC9hcGkvcHJvamVjdDQ0LW9hdXRoOicsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgIGlmICghcmVzLmhlYWRlcnNTZW50KSB7XG4gICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1Byb3h5IGVycm9yIG9jY3VycmVkJyB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnL2FwaS9wcm9qZWN0NDQnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vbmExMi5hcGkucHJvamVjdDQ0LmNvbScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiB0cnVlLFxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvcHJvamVjdDQ0LywgJycpLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0hvc3QnOiAnbmExMi5hcGkucHJvamVjdDQ0LmNvbSdcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCBfcmVxLCBfcmVzKSA9PiB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgT3JpZ2luIGhlYWRlciB0byBieXBhc3MgQ09SUyByZXN0cmljdGlvbnNcbiAgICAgICAgICAgIHByb3h5UmVxLnJlbW92ZUhlYWRlcignb3JpZ2luJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVyciwgX3JlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQcm94eSBlcnJvciBmb3IgL2FwaS9wcm9qZWN0NDQ6JywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgaWYgKCFyZXMuaGVhZGVyc1NlbnQpIHtcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUHJveHkgZXJyb3Igb2NjdXJyZWQnIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICcvYXBpL2ZyZXNoeCc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly9hcGkuZ2V0ZnJlc2h4LmNvbScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiB0cnVlLFxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvZnJlc2h4LywgJycpLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0hvc3QnOiAnYXBpLmdldGZyZXNoeC5jb20nXG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5LCBfb3B0aW9ucykgPT4ge1xuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgX3JlcSwgX3JlcykgPT4ge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIE9yaWdpbiBoZWFkZXIgdG8gYnlwYXNzIENPUlMgcmVzdHJpY3Rpb25zXG4gICAgICAgICAgICBwcm94eVJlcS5yZW1vdmVIZWFkZXIoJ29yaWdpbicpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignUHJveHkgZXJyb3IgZm9yIC9hcGkvZnJlc2h4OicsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgIGlmICghcmVzLmhlYWRlcnNTZW50KSB7XG4gICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1Byb3h5IGVycm9yIG9jY3VycmVkJyB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLHdCQUF3QjtBQUFBLFFBQ3RCLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxRQUNSLFNBQVMsQ0FBQyxTQUFTLEtBQUssUUFBUSwyQkFBMkIsRUFBRTtBQUFBLFFBQzdELFNBQVM7QUFBQSxVQUNQLFFBQVE7QUFBQSxRQUNWO0FBQUEsUUFDQSxXQUFXLENBQUMsT0FBTyxhQUFhO0FBQzlCLGdCQUFNLEdBQUcsWUFBWSxDQUFDLFVBQVUsTUFBTSxTQUFTO0FBRTdDLHFCQUFTLGFBQWEsUUFBUTtBQUFBLFVBQ2hDLENBQUM7QUFDRCxnQkFBTSxHQUFHLFNBQVMsQ0FBQyxLQUFLLE1BQU0sUUFBUTtBQUNwQyxvQkFBUSxNQUFNLHlDQUF5QyxJQUFJLE9BQU87QUFDbEUsZ0JBQUksQ0FBQyxJQUFJLGFBQWE7QUFDcEIsa0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELGtCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyx1QkFBdUIsQ0FBQyxDQUFDO0FBQUEsWUFDM0Q7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLE1BQ0Esa0JBQWtCO0FBQUEsUUFDaEIsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLHFCQUFxQixFQUFFO0FBQUEsUUFDdkQsU0FBUztBQUFBLFVBQ1AsUUFBUTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFdBQVcsQ0FBQyxPQUFPLGFBQWE7QUFDOUIsZ0JBQU0sR0FBRyxZQUFZLENBQUMsVUFBVSxNQUFNLFNBQVM7QUFFN0MscUJBQVMsYUFBYSxRQUFRO0FBQUEsVUFDaEMsQ0FBQztBQUNELGdCQUFNLEdBQUcsU0FBUyxDQUFDLEtBQUssTUFBTSxRQUFRO0FBQ3BDLG9CQUFRLE1BQU0sbUNBQW1DLElBQUksT0FBTztBQUM1RCxnQkFBSSxDQUFDLElBQUksYUFBYTtBQUNwQixrQkFBSSxVQUFVLEtBQUssRUFBRSxnQkFBZ0IsbUJBQW1CLENBQUM7QUFDekQsa0JBQUksSUFBSSxLQUFLLFVBQVUsRUFBRSxPQUFPLHVCQUF1QixDQUFDLENBQUM7QUFBQSxZQUMzRDtBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0g7QUFBQSxNQUNGO0FBQUEsTUFDQSxlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsUUFDUixTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEsa0JBQWtCLEVBQUU7QUFBQSxRQUNwRCxTQUFTO0FBQUEsVUFDUCxRQUFRO0FBQUEsUUFDVjtBQUFBLFFBQ0EsV0FBVyxDQUFDLE9BQU8sYUFBYTtBQUM5QixnQkFBTSxHQUFHLFlBQVksQ0FBQyxVQUFVLE1BQU0sU0FBUztBQUU3QyxxQkFBUyxhQUFhLFFBQVE7QUFBQSxVQUNoQyxDQUFDO0FBQ0QsZ0JBQU0sR0FBRyxTQUFTLENBQUMsS0FBSyxNQUFNLFFBQVE7QUFDcEMsb0JBQVEsTUFBTSxnQ0FBZ0MsSUFBSSxPQUFPO0FBQ3pELGdCQUFJLENBQUMsSUFBSSxhQUFhO0FBQ3BCLGtCQUFJLFVBQVUsS0FBSyxFQUFFLGdCQUFnQixtQkFBbUIsQ0FBQztBQUN6RCxrQkFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sdUJBQXVCLENBQUMsQ0FBQztBQUFBLFlBQzNEO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
