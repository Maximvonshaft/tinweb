import type { MockMethod } from 'vite-plugin-mock';
import { loadDatasetMocks } from './dataset';

export default loadDatasetMocks() as MockMethod[];
