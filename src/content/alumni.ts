/**
 * Past office bearers. Source: https://auceg.acm.org/alumni.html ("OFFICE BEARERS").
 * When a team graduates, move its office bearers here (newest year first).
 */
import { siteMedia, type MediaAsset } from './media';

export interface AlumniEntry {
  name: string;
  position: string;
  linkedin?: string;
  photo?: MediaAsset;
}

export interface AlumniYear {
  year: string;
  bearers: AlumniEntry[];
}

const a = (path: string, name: string) => siteMedia(`alumni.${path}`, `alumni/${path}`, name);

export const ALUMNI: AlumniYear[] = [
  {
    year: '2024–2025',
    bearers: [
      { name: 'Ansh Bomb', position: 'Chairperson', photo: a('2024-2025/Chair.jpg', 'Ansh Bomb'), linkedin: 'https://www.linkedin.com/in/ansh-bomb/' },
      { name: 'Shiyam Ganesh T', position: 'Vice Chairperson', photo: a('2024-2025/Vice_Chairperson.png', 'Shiyam Ganesh T'), linkedin: 'https://www.linkedin.com/in/shiyam-ganesh-t/' },
      { name: 'Harish Kummar K G S', position: 'Secretary', photo: a('2024-2025/Secretary.jpg', 'Harish Kummar K G S'), linkedin: 'https://www.linkedin.com/in/harish-kummar-k-g-s/' },
      { name: 'Shanthapriya Manikandan', position: 'Treasurer', photo: a('2024-2025/Treasurer1.jpg', 'Shanthapriya Manikandan'), linkedin: 'https://www.linkedin.com/in/shanthapriyamanikandan/' },
    ],
  },
  {
    year: '2023–2024',
    bearers: [
      { name: 'Arunachalam', position: 'Chairperson', photo: a('2023_2024/directors/C_Arunachalam.jpg', 'Arunachalam'), linkedin: 'https://www.linkedin.com/in/arunachalam-manikandan/' },
      { name: 'Rishitha', position: 'Vice Chairperson', photo: a('2023_2024/directors/VC_Rishitha.jpg', 'Rishitha'), linkedin: 'https://www.linkedin.com/in/rishitha-n-a19882227/' },
      { name: 'Ashwin Muthuraman', position: 'Secretary', photo: a('2023_2024/directors/S_Ashwin_Muthuraman.jpg', 'Ashwin Muthuraman'), linkedin: 'https://www.linkedin.com/in/a-ashwin-muthuraman/' },
      { name: 'Shivaani', position: 'Treasurer', photo: a('2023_2024/directors/T_Shivaani.jpeg', 'Shivaani'), linkedin: 'https://www.linkedin.com/in/shivaani-s-9b067b21a/' },
    ],
  },
  {
    year: '2022–2023',
    bearers: [
      { name: 'Bharath Kumar', position: 'Chairperson', photo: a('C_Bharath kumar.jpg', 'Bharath Kumar'), linkedin: 'https://www.linkedin.com/in/bharath-kumar-d-p-20861792/' },
      { name: 'Asmitha Eswaran', position: 'Vice Chairperson', photo: a('VC_Asmitha Eswaran.jpg', 'Asmitha Eswaran'), linkedin: 'https://www.linkedin.com/in/e-asmitha-shrree-023b251a7/' },
      { name: 'Pranava Raman', position: 'Secretary', photo: a('S_Pranava Raman BMS.jpeg', 'Pranava Raman'), linkedin: 'https://www.linkedin.com/in/pranava-raman-bms/' },
      { name: 'Akshayalakshmi V K', position: 'Secretary', photo: a('S_Akshayalakshmi V K.jpeg', 'Akshayalakshmi V K'), linkedin: 'https://www.linkedin.com/in/akshayalakshmi-v-k-2803911b1/' },
      { name: 'Vasudha', position: 'Treasurer', photo: a('T_VASUDHA E.jpg', 'Vasudha'), linkedin: 'https://www.linkedin.com/in/vasudha-e-bab011214/' },
    ],
  },
];
