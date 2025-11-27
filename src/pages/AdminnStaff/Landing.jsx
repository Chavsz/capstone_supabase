import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";

const Landing = () => {
  const [landingData, setLandingData] = useState(null);
  const [formData, setFormData] = useState({
    home_image: null,
    home_title: "",
    home_description: "",
    home_more: "",
    about_image: null,
    about_title: "",
    about_description: "",
    about_link: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const { data, error } = await supabase
          .from("landing")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setLandingData(data);
          setFormData({
            home_image: data.home_image || "",
            home_title: data.home_title || "",
            home_description: data.home_description || "",
            home_more: data.home_more || "",
            about_image: data.about_image || "",
            about_title: data.about_title || "",
            about_description: data.about_description || "",
            about_link: data.about_link || "",
          });
        } else {
          // Set default empty values if no data exists
          setFormData({
            home_image: "",
            home_title: "",
            home_description: "",
            home_more: "",
            about_image: "",
            about_title: "",
            about_description: "",
            about_link: "",
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        // Set default empty values if there's an error
        setFormData({
          home_image: "",
          home_title: "",
          home_description: "",
          home_more: "",
          about_image: "",
          about_title: "",
          about_description: "",
          about_link: "",
        });
      }
    };

    fetchLandingData();
  }, []);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "home_image" || name === "about_image") {
      setFormData((prevData) => ({
        ...prevData,
        [name]: files[0],
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  // Upload image to Supabase Storage
  const uploadImage = async (file, imageType) => {
    if (!file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${imageType}_${Date.now()}.${fileExt}`;
      const filePath = `landing-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('capstone')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('capstone')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  // Delete image from Supabase Storage
  const deleteImage = async (imageUrl) => {
    if (!imageUrl) return;
    
    try {
      // Extract file path from URL
      const urlObj = new URL(imageUrl);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.indexOf('capstone');
      
      if (bucketIndex === -1) {
        console.warn("Could not extract file path from URL:", imageUrl);
        return;
      }
      
      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      
      const { error } = await supabase.storage
        .from('capstone')
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting image:", error);
      // Don't throw - image deletion failure shouldn't block operations
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let homeImageUrl = landingData?.home_image || null;
      let aboutImageUrl = landingData?.about_image || null;

      // Upload new images if they are File objects
      if (formData.home_image instanceof File) {
        // Delete old image if it exists
        if (landingData?.home_image) {
          await deleteImage(landingData.home_image);
        }
        homeImageUrl = await uploadImage(formData.home_image, 'home');
      } else if (formData.home_image && typeof formData.home_image === 'string') {
        // Keep existing image URL if it's a string
        homeImageUrl = formData.home_image;
      }

      if (formData.about_image instanceof File) {
        // Delete old image if it exists
        if (landingData?.about_image) {
          await deleteImage(landingData.about_image);
        }
        aboutImageUrl = await uploadImage(formData.about_image, 'about');
      } else if (formData.about_image && typeof formData.about_image === 'string') {
        // Keep existing image URL if it's a string
        aboutImageUrl = formData.about_image;
      }

      // Prepare data for Supabase
      const landingDataToSave = {
        home_title: formData.home_title,
        home_description: formData.home_description,
        home_more: formData.home_more,
        home_image: homeImageUrl,
        about_title: formData.about_title,
        about_description: formData.about_description,
        about_link: formData.about_link,
        about_image: aboutImageUrl,
      };

      // Check if landing data already exists
      if (landingData?.id) {
        // Update existing record
        const { data, error } = await supabase
          .from("landing")
          .update(landingDataToSave)
          .eq("id", landingData.id)
          .select()
          .single();

        if (error) throw error;
        setLandingData(data);
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from("landing")
          .insert([landingDataToSave])
          .select()
          .single();

        if (error) throw error;
        setLandingData(data);
      }

      toast.success("Changes saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-[24px] font-bold text-gray-600 mb-6">Landing</h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto bg-white p-6 rounded-lg border border-gray-300 "
      >
        <div className="mb-4">
          <label
            htmlFor="home_title"
            className="block text-sm font-semibold text-gray-700"
          >
            Home Title:
          </label>
          <input
            type="text"
            name="home_title"
            value={formData.home_title}
            onChange={handleChange}
            placeholder="Enter Home Title"
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="home_description"
            className="block text-sm font-semibold text-gray-700"
          >
            Home Description:
          </label>
          <textarea
            name="home_description"
            value={formData.home_description}
            onChange={handleChange}
            placeholder="Enter Home Description"
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="home_more"
            className="block text-sm font-semibold text-gray-700"
          >
            {" "}
            More:
          </label>
          <input
            type="text"
            name="home_more"
            value={formData.home_more}
            onChange={handleChange}
            placeholder="Enter Learn More Text"
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="home_image"
            className="block text-sm font-semibold text-gray-700"
          >
            Home Image Upload:
          </label>
          <input
            type="file"
            name="home_image"
            accept="image/*"
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {landingData?.home_image && (
            <p className="text-sm text-gray-500 mt-1">
              Current image: <a href={landingData.home_image} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
            </p>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="about_title"
            className="block text-sm font-semibold text-gray-700"
          >
            About Title:
          </label>
          <input
            type="text"
            name="about_title"
            value={formData.about_title}
            onChange={handleChange}
            placeholder="Enter About Title"
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="about_description"
            className="block text-sm font-semibold text-gray-700"
          >
            About Description:
          </label>
          <textarea
            name="about_description"
            value={formData.about_description}
            onChange={handleChange}
            placeholder="Enter About Description"
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="about_link"
            className="block text-sm font-semibold text-gray-700"
          >
            About Link:
          </label>
          <input
            type="url"
            name="about_link"
            value={formData.about_link}
            onChange={handleChange}
            placeholder="Enter About Link"
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="about_image"
            className="block text-sm font-semibold text-gray-700"
          >
            About Image Upload:
          </label>
          <input
            type="file"
            name="about_image"
            accept="image/*"
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {landingData?.about_image && (
            <p className="text-sm text-gray-500 mt-1">
              Current image: <a href={landingData.about_image} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full p-3 bg-blue-600 text-white font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
};

export default Landing;
