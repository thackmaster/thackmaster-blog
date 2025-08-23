// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightBlog from 'starlight-blog';
import starlightGiscus from 'starlight-giscus';
import starlightImageZoom from 'starlight-image-zoom';
import starlightThemeGalaxy from 'starlight-theme-galaxy';
import starlightLinksValidator from 'starlight-links-validator';
//import starlightThemeRapide from 'starlight-theme-rapide';

// https://astro.build/config
export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 4321
	},
	integrations: [
		starlight({
			title: 'thackmaster',
			customCss: [
				'./src/styles/custom.css',
				'@fontsource/nunito/400.css',
				'@fontsource/montserrat/400.css'
			],
			editLink: { 
				baseUrl: 'https://github.com/thackmaster/thackmaster-blog/edit/main/docs' 
			},
			plugins: [
				starlightImageZoom(),
				//starlightThemeRapide(),
				starlightThemeGalaxy(),
				starlightLinksValidator(),
				starlightBlog({
					title: "Blog",
					postCount: 5,
					authors: {
						thackmaster: {
							name: 'thackmaster',
							title: 'author, owner, astro novice',
							picture: 'https://avatars.githubusercontent.com/u/73045785',
							url: 'https://wesleythacker.com',
						},
					},
					navigation: 'header-end',
					metrics: {
						readingTime: true,
						//words: 'total',
					},
				}),
				starlightGiscus({
					repo: 'thackmaster/thackmaster-blog',
					repoId: 'R_kgDOOrbWNw',
					category: 'Comments',
					categoryId: 'DIC_kwDOOrbWN84CuOe',
				}),
			],
		}),
	],
});
